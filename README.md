# FIT — habit tracker

Edzés- és életmódcélok követése kis csapatnak. Telefonra tervezve: minden
embernek saját táblázata van, ahol a sorok a célok, az oszlopok pedig az
aktuális hét napjai hétfőtől vasárnapig. Koppintással lehet X-elni, a hét
végén egy `Σ` oszlop mutatja a heti teljesülést (pl. `2/4`). A főoldalon
mindenkihez tartozik egy gyűrű a havi százalékkal.

Nincs build lépés: statikus HTML + ES modulok. Az adatot egy Supabase projekt
tárolja, hogy mindenki ugyanazt lássa a saját telefonjáról.

---

## 1. Supabase projekt

1. [supabase.com](https://supabase.com) → **New project** (az ingyenes csomag bőven elég).
2. **SQL Editor** → illeszd be a [`supabase/schema.sql`](supabase/schema.sql)
   tartalmát → **Run**. Ez létrehozza a `people`, `goals`, `completions`
   táblákat, a hozzáférési szabályokat és bekapcsolja az élő szinkront.
   A fájl újrafuttatható: ha bővül a séma (pl. profilkép-oszloppal), elég
   ugyanezt megismételni, a meglévő adat megmarad.
3. **Project Settings → API**: másold ki a `Project URL`-t és az `anon public`
   kulcsot.

## 2. Kapcsolat beállítása

Két lehetőség:

**A) Bedrótozva (ajánlott)** — írd be az értékeket
[`assets/js/config.js`](assets/js/config.js)-be:

```js
export const SUPABASE_URL = 'https://xxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOi…';
```

Így senkinek nem kell semmit beírnia, csak megnyitja az oldalt. Az `anon` kulcs
szándékosan publikus, nyugodtan bekerülhet a repóba.

**B) Eszközönként** — hagyd üresen a `config.js`-t. Az oldal első megnyitáskor
kér egy URL-t és kulcsot, és a böngésző `localStorage`-ában tárolja. Ezt
minden telefonon egyszer meg kell tenni. Később a `#/setup` címen módosítható.

## 3. Közzététel

Bármelyik statikus tárhely jó, nincs build parancs és nincs kimeneti könyvtár.

**GitHub Pages**

```bash
git init && git add . && git commit -m "FIT habit tracker"
git branch -M main
git remote add origin git@github.com:FELHASZNALO/fit.git
git push -u origin main
```

Ezután **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
Az oldal pár perc múlva elérhető a `https://FELHASZNALO.github.io/fit/` címen.

**Netlify** — húzd rá a mappát a [app.netlify.com/drop](https://app.netlify.com/drop)
felületre, vagy kösd be a repót (build parancs: üres, publish könyvtár: `.`).

**Helyben**

```bash
python3 -m http.server 8000
# majd http://localhost:8000
```

A `file://` protokoll nem működik, mert ES modulokat használ az oldal.

---

## Használat

- **Főoldal** — minden ember egy kártyán, gyűrűvel: a havi célok hány százaléka
  teljesült. A gyűrűn lévő vékony szürke vonal azt jelzi, hol tartunk időben a
  hónapban — a fölötte lévő kitöltés azt jelenti, hogy jól áll a hónap.
  Felül a csapat összesített százaléka.
- **Ki vagy?** — az oldal megnyitása mindig a profilválasztóval kezdődik (nagy,
  kör alakú profilok, mint a Netflixen), ahol ki kell választani, ki használja
  az eszközt. Új embert csak innen lehet felvenni, a sor végi `+` gombbal. Ezután
  **csak a saját profilodban lehet X-elni és célt felvenni**; a többiekét
  látod, de nem tudod véletlenül elrontani. Nincs jelszó — ez csak az
  elkattintás ellen véd, nem biztonsági funkció. A választás ezen az eszközön
  marad meg, és a főoldal fejlécében lévő névre koppintva váltható.
- **Profilkép** — a saját profilodban a `⋯` menüben. Telefonon a gomb felkínálja
  a kamerát és a galériát is. A böngésző négyzetre vágja és 200×200-ra
  kicsinyíti a képet (jellemzően 10–15 kB), és így kerül az adatbázisba —
  nincs szükség külön fájltárolóra.
- **Sorrend** — a profilválasztón nyomd meg és tartsd egy profilon az ujjad,
  majd húzd a helyére. Az így mentett sorrend a főoldalon is érvényes.
- **Szín** — a saját profilodban a `⋯` menüben, négy szín közül. A választás a
  profilhoz tartozik (nem az eszközhöz), tehát bármelyik telefonon ugyanaz, és
  bármikor átállítható. A színválasztás azonnal látszik a felületen, de csak a
  **Mentés** gombbal rögzül.
- **Világos / sötét mód** — a fejléc ikonjával, három állapot között váltva:
  rendszer szerint → világos → sötét. A választás az adott eszközön marad meg.
- **Egy ember** — koppints a kártyájára. Belépéskor mindig az aktuális hét jön
  be, hétfőtől vasárnapig, utána a `Σ` oszloppal. Koppints egy cellára az
  X-hez, még egyszer a visszavonáshoz.
- **Hétváltás** — a `‹ ›` nyilakkal, vagy a táblázatot oldalra húzva. A 2026.
  augusztus 1-je előtti napok nincsenek engedélyezve, ekkor indult a követés.
- **Havi állás** — a táblázat alatt célonként, sávdiagrammal; a fenti gyűrű az
  egész hónap összesített százaléka.
- **Új cél** — a gombbal: megnevezés + alkalomszám + `hetente` vagy `havonta`
  (pl. „Edzés, 4×, hetente”, „Úszás, 4×, havonta”).
- **Cél szerkesztése / törlése** — koppints a cél nevére a bal oldali oszlopban.
- **Ember átnevezése / törlése** — a `⋯` gomb a fejlécben.
- **Hónapváltás** — a főoldalon, a `‹ ›` nyilakkal.

A hónapfordulóra eső hét ahhoz a hónaphoz számít, amelyikben véget ér — a
„Havi állás” tehát a hét vasárnapjának hónapját mutatja.

Az adat élőben szinkronizál: ha valaki X-el, a többiek telefonján is megjelenik
újratöltés nélkül.

### Hogyan jön ki a százalék

Egy heti cél havi darabszáma = `gyakoriság × a hónap hetei`, ahol a hetek száma
a hónap napjai / 7, kerekítve. Augusztusra (31 nap) ez 4 hét.

> Heti 4 edzés → 4 × 4 = **16**
> Havi 4 úszás → **4**
> Havi célszám összesen: **20**. Ebből 15 teljesült → **75%**.

Egy cél a saját darabszámánál többel nem számít bele: ha valaki 20 edzést
végez 16 helyett, az nem pótolja a kihagyott úszásokat.

A heti `Σ` oszlop heti céloknál `teljesült/cél` alakban jelenik meg (zöld, ha
megvan), havi céloknál csak a heti darabszámot mutatja — azoknál a `Hó` oszlop
a mérvadó.

---

## Fájlok

```
index.html                  váz
manifest.webmanifest        kezdőképernyőre tehető alkalmazás
assets/css/style.css        teljes megjelenés (világos + sötét mód)
assets/js/config.js         >>> ide jönnek a Supabase adatok <<<
assets/js/app.js            útvonalválasztás, beállító képernyő, élő szinkron
assets/js/db.js             minden adatbázis-hívás
assets/js/session.js        „ki használja az eszközt” (localStorage)
assets/js/theme.js          világos / sötét / rendszer szerinti mód
assets/js/accent.js         a profilhoz választott alapszín
assets/js/avatar.js         profilkép megjelenítése és kicsinyítése
assets/js/reorder.js        sorrend átrendezése húzással (érintőképernyőn is)
assets/js/util.js           dátum- és célszámítás
assets/js/chart.js          az előrehaladás-gyűrű
assets/js/ui.js             alsó lapok, megerősítés, buborék-üzenetek
assets/js/views/dashboard.js  főnézet
assets/js/views/person.js     egy ember heti táblázata
assets/js/views/picker.js     „Ki vagy?” profilválasztó
supabase/schema.sql         adatbázis séma
```

## Színek

Négy alapszín választható a felületen (profilonként, a `⋯` menüben): **lila,
kék, zöld, narancs**. Mindegyikhez tartozik egy világos és egy sötét lépcső, és
egy hozzá olvasható felirat-szín — a világos zöldön és narancson a fehér már nem
lenne az, ezért ott sötét a tömör gombok szövege.

A profil `color` mezője csak a kulcsot tárolja (`violet`, `blue`, `teal`,
`orange`); az árnyalatokat a [`assets/css/style.css`](assets/css/style.css)
tetején lévő `--c-*` és `--on-*` változók adják, világos és sötét témához külön.
Másik palettához elég ezeket átírni.

A **profilválasztó képernyő fekete-fehér**, és nem követi a választott színt —
ott még nem dőlt el, kinek a színe lesz érvényben. Világos módban fehér kör
vékony fekete körvonallal és fekete betűkkel, sötét módban fordítva; a
feltöltött képek is szürkeárnyalatosan jelennek meg. Ha színesen kellenének, a
`.whois__item .avatar img` szabályból a `filter: grayscale(1)` sort kell kivenni.

A zöld (`#0ca30c`) mint „megvan a heti cél” jelzés minden színnél ugyanaz marad,
hogy ne keveredjen az alapszínnel — a `teal` választásnál a kettő közel kerül
egymáshoz, de a Σ oszlop zöld háttere és a szám együtt továbbra is egyértelmű.

## Biztonságról

Nincs bejelentkezés, és a séma nyitott írási joggal jön: aki ismeri az oldal
címét, az szerkeszthet. Ez tudatos kompromisszum egy pár fős, privát csoportnál
— cserébe nincs jelszókezelés. Ha később kell belépés, a `schema.sql`
`public_all` policy-jeit kell szigorítani (pl. `using (auth.uid() is not null)`),
és be kell tenni egy Supabase Auth belépőt.
