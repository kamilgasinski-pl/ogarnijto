import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LUKA, type Odpowiedz, type Parametry, type Pytanie } from "@/lib/testy";

// Generowanie testu przez Google Gemini (darmowy poziom). Klucz jest tylko na serwerze.
export const maxDuration = 60;

const MODELE = (process.env.GEMINI_MODEL ?? "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite").split(",").map((m) => m.trim());

type SurowePytanie = {
  typ?: string;
  tresc?: string;
  opcje?: unknown;
  poprawna?: unknown;
  prawda?: unknown;
  odpowiedz?: unknown;
};

function instrukcja(tekst: string, p: Parametry, przedmiot: string) {
  return `Jesteś nauczycielem${przedmiot ? ` przedmiotu: ${przedmiot}` : ""}. Na podstawie WYŁĄCZNIE poniższego tekstu z podręcznika ułóż test sprawdzający wiedzę ucznia szkoły podstawowej przed sprawdzianem.

Wymagania:
- Pisz po polsku, poprawną polszczyzną, prostym językiem dla ucznia.
- Pytania muszą sprawdzać rozumienie najważniejszych pojęć, definicji, faktów i zależności z tekstu, a nie szczegóły typograficzne ani numery rysunków.
- Nie wymyślaj faktów spoza tekstu. Ignoruj śmieci z odczytu OCR (urwane słowa, fragmenty tabel).
- Typy pytań i liczba (nie przekraczaj; jeśli materiału jest za mało, daj mniej):
  * "wybor": ${p.wybor} pytań jednokrotnego wyboru, dokładnie 4 opcje; jedna poprawna, trzy wiarygodne, ale błędne (typowe pomyłki uczniów, podobna długość i forma gramatyczna). Pole "poprawna" to indeks 0-3 poprawnej opcji.
  * "luka": ${p.luki} zdań z luką oznaczoną dokładnie ciągiem ${LUKA} w miejscu kluczowego pojęcia lub liczby; "odpowiedz" to brakujące słowo.
  * "pf": ${p.pf} zdań prawda/fałsz (mniej więcej połowa fałszywych, ale fałsz musi być merytoryczny, nie gramatyczny); "prawda" to true/false, "odpowiedz" to krótkie uzasadnienie.
  * "otwarte": ${p.otwarte} pytań otwartych wymagających krótkiej odpowiedzi własnymi słowami; "odpowiedz" to wzorcowa odpowiedź (1-3 zdania).
- Pytania nie mogą się powtarzać ani zdradzać odpowiedzi na inne pytania.

Zwróć WYŁĄCZNIE poprawny JSON w postaci:
{"pytania":[{"typ":"wybor","tresc":"...","opcje":["...","...","...","..."],"poprawna":0,"odpowiedz":"treść poprawnej opcji"},{"typ":"luka","tresc":"zdanie z ${LUKA}","odpowiedz":"..."},{"typ":"pf","tresc":"...","prawda":true,"odpowiedz":"..."},{"typ":"otwarte","tresc":"...","odpowiedz":"..."}]}

TEKST Z PODRĘCZNIKA:
"""
${tekst}
"""`;
}

function tasuj<T>(t: T[]): T[] {
  const w = [...t];
  for (let i = w.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [w[i], w[j]] = [w[j], w[i]];
  }
  return w;
}

function zbuduj(surowe: SurowePytanie[], p: Parametry): { pytania: Pytanie[]; odpowiedzi: Odpowiedz[] } {
  const limit: Record<string, number> = { wybor: p.wybor, luka: p.luki, pf: p.pf, otwarte: p.otwarte };
  const licznik: Record<string, number> = { wybor: 0, luka: 0, pf: 0, otwarte: 0 };
  const pytania: Pytanie[] = [];
  const odpowiedzi: Odpowiedz[] = [];
  let nr = 0;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  for (const s of surowe) {
    const typ = str(s.typ);
    const tresc = str(s.tresc);
    if (!tresc || !(typ in limit) || licznik[typ] >= limit[typ]) continue;
    const id = `q${++nr}`;
    const odp = str(s.odpowiedz);
    if (typ === "wybor") {
      const opcje = Array.isArray(s.opcje) ? s.opcje.map(str).filter(Boolean) : [];
      const idx = typeof s.poprawna === "number" ? s.poprawna : -1;
      if (opcje.length < 3 || idx < 0 || idx >= opcje.length || new Set(opcje).size !== opcje.length) {
        nr--;
        continue;
      }
      const poprawna = opcje[idx];
      const przetasowane = tasuj(opcje); // model lubi stawiać poprawną na początku
      pytania.push({ id, typ: "wybor", tresc, opcje: przetasowane });
      odpowiedzi.push({ id, tekst: poprawna, poprawna: przetasowane.indexOf(poprawna) });
    } else if (typ === "luka") {
      const z = tresc.includes(LUKA) ? tresc : tresc.replace(/_{3,}|\.{4,}|…{2,}/u, LUKA);
      if (!z.includes(LUKA) || !odp) {
        nr--;
        continue;
      }
      pytania.push({ id, typ: "luka", tresc: z });
      odpowiedzi.push({ id, tekst: odp });
    } else if (typ === "pf") {
      if (typeof s.prawda !== "boolean") {
        nr--;
        continue;
      }
      pytania.push({ id, typ: "pf", tresc });
      odpowiedzi.push({
        id,
        tekst: `${s.prawda ? "Prawda." : "Fałsz."}${odp ? ` ${odp}` : ""}`,
        prawda: s.prawda,
      });
    } else {
      if (!odp) {
        nr--;
        continue;
      }
      pytania.push({ id, typ: "otwarte", tresc, linie: odp.length > 160 ? 4 : 3 });
      odpowiedzi.push({ id, tekst: odp });
    }
    licznik[typ]++;
  }
  const rzad = { wybor: 0, luka: 1, pf: 2, otwarte: 3 } as const;
  pytania.sort((a, b) => rzad[a.typ] - rzad[b.typ]);
  return { pytania, odpowiedzi };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ blad: "Zaloguj się ponownie." }, { status: 401 });

  const klucz = process.env.GEMINI_API_KEY;
  if (!klucz) {
    return NextResponse.json(
      { blad: "Generowanie przez AI nie jest jeszcze skonfigurowane (brak klucza GEMINI_API_KEY). Użyj generatora podstawowego." },
      { status: 503 },
    );
  }

  let body: { tekst?: string; parametry?: Parametry; przedmiot?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ blad: "Nieprawidłowe dane." }, { status: 400 });
  }
  const tekst = (body.tekst ?? "").trim().slice(0, 24000);
  if (tekst.length < 200) {
    return NextResponse.json({ blad: "Za mało tekstu dla AI (potrzeba co najmniej kilku zdań)." }, { status: 400 });
  }
  const liczba = (n: unknown) => Math.max(0, Math.min(30, Math.floor(Number(n) || 0)));
  const p: Parametry = {
    wybor: liczba(body.parametry?.wybor),
    luki: liczba(body.parametry?.luki),
    pf: liczba(body.parametry?.pf),
    otwarte: liczba(body.parametry?.otwarte),
  };
  const przedmiot = (body.przedmiot ?? "").trim().slice(0, 60);

  let ostatniBlad = "Nie udało się połączyć z AI.";
  const start = Date.now();
  const pauza = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (const model of MODELE) {
    // Przy chwilowym przeciążeniu (503/500) ponawiamy ten sam model, potem bierzemy następny.
    for (let proba = 0; proba < 2; proba++) {
      if (Date.now() - start > 45000) break;
      let odp: Response;
      try {
        odp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": klucz },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: instrukcja(tekst, p, przedmiot) }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.6 },
          }),
          signal: AbortSignal.timeout(25000),
        });
      } catch {
        ostatniBlad = "AI nie odpowiedziało na czas. Spróbuj ponownie.";
        break;
      }

      if (odp.status === 429) {
        ostatniBlad = "LIMIT";
        break; // limit dotyczy modelu, próbujemy następnego
      }
      if (!odp.ok) {
        const szczegol = await odp.json().then((d) => String(d?.error?.message ?? "").slice(0, 160)).catch(() => "");
        console.error("Gemini", model, odp.status, szczegol);
        if (odp.status === 503 || odp.status === 500) {
          ostatniBlad = `Serwery AI są chwilowo przeciążone (${odp.status}). Spróbuj za minutę.`;
          if (proba === 0) {
            await pauza(1500);
            continue;
          }
          break;
        }
        if (odp.status === 404) {
          ostatniBlad = `Model ${model} jest niedostępny dla tego klucza.${szczegol ? ` (${szczegol})` : ""}`;
          break;
        }
        ostatniBlad =
          odp.status === 400 || odp.status === 403
            ? `Google odrzuciło zapytanie (${odp.status})${szczegol ? `: ${szczegol}` : ""}`
            : `AI zwróciło błąd (${odp.status}).`;
        break;
      }

      try {
        const dane = await odp.json();
        const surowy: string = dane?.candidates?.[0]?.content?.parts?.map((x: { text?: string }) => x.text ?? "").join("") ?? "";
        const json = JSON.parse(surowy.replace(/^```(?:json)?\s*|\s*```$/g, ""));
        const wynik = zbuduj(Array.isArray(json?.pytania) ? json.pytania : [], p);
        if (wynik.pytania.length === 0) {
          ostatniBlad = "AI nie ułożyło pytań z tego tekstu. Popraw tekst lub użyj generatora podstawowego.";
          break;
        }
        const uwagi: string[] = [];
        const oczekiwane = p.wybor + p.luki + p.pf + p.otwarte;
        if (wynik.pytania.length < oczekiwane) uwagi.push(`AI ułożyło ${wynik.pytania.length} z ${oczekiwane} pytań.`);
        return NextResponse.json({ ...wynik, uwagi, model });
      } catch {
        ostatniBlad = "Nie udało się odczytać odpowiedzi AI. Spróbuj ponownie.";
        break;
      }
    }
  }

  if (ostatniBlad === "LIMIT") {
    return NextResponse.json(
      { blad: "Darmowy limit generowania przez AI został wyczerpany. Spróbuj ponownie za jakiś czas (limit odnawia się codziennie) albo użyj generatora podstawowego.", limit: true },
      { status: 429 },
    );
  }
  return NextResponse.json({ blad: ostatniBlad }, { status: 502 });
}
