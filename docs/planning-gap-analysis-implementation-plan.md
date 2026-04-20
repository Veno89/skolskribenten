# Implementeringsplan: "Vad har jag glömt?"

## Mål
Bygga en robust planeringsyta där lärare kan:
1. markera vad som är gjort/pågår/ej gjort inom centralt innehåll,
2. få tydlig gap-analys,
3. skapa ett AI-underlag för nästa steg utan att lagra känsligt elevinnehåll i databasen.

## Arkitektur (MVP)

### 1) Datamodell för innehåll
- `lib/planning/curriculum.ts`
- Strukturerad ämnesmodell: ämne -> område -> innehållspunkter.
- Initialt scope: Historia + Religionskunskap (7-9), med tydliga id:n för framtida utökning.

### 2) Lokal persistens
- `lib/planning/checklist-storage.ts`
- Versionerad localStorage-envelope (`version: 1`) för säker migrering senare.
- Nyckel scope: `userId + subject + area` för att undvika kollisioner.

### 3) Affärslogik
- `lib/planning/gap-analysis.ts`
- Ren funktionslogik för:
  - defaultstatus,
  - gap-beräkning,
  - generering av strukturerat AI-underlag.

### 4) UI och tillstånd
- `hooks/usePlanningChecklist.ts`
- `components/planning/PlanningWorkspace.tsx`
- Hook separerar state/persistens från presentation.
- Workspace visar checklista, statistik, luckor och kopierbart AI-underlag.

### 5) Integration i dashboard
- `app/(dashboard)/lektionsplanering/page.tsx`
- Befintlig route återanvänds men visar nu faktisk arbetsyta.

## Kvalitet och riskhantering
- Hålla filer fokuserade och små (domän/hook/ui/test separerade).
- Ren logik i testbara util-filer.
- Ingen DB-migration i MVP (minskar risk för driftpåverkan).
- Versionerad localStorage för framtida schemaändringar.

## Status efter nuvarande implementation
- ✅ Lokal checklista + gap-analys på plats.
- ✅ Export/import av planeringar i JSON-format på plats (för byte av dator/webbläsare).
- ✅ Grund för Pro-cloudsync på plats (API + hook + UI-status).
- ✅ Onboardingpanel + mini promptskola på plats i planeringsytan.
- ✅ Första version av konflikthantering i cloudsync på plats (nyare serverstate vinner).
- ✅ Första version av konflikt-sammanfogning och sync-logg i UI på plats.
- ✅ Första version av offline-synkkö med flush vid online/retry på plats.
- ✅ Direkt AI-generering från planeringsytan på plats.
- ✅ Utökad ämneskatalog (inkl. samhällskunskap 7-9).
- ⏳ Fördjupad återhämtningslogik kvarstår.

## Nästa steg efter nuvarande implementation
1. Utöka ämneskatalog med fler ämnen/årskurser.
2. Förbättra server-synk med mer avancerad merge-strategi för konfliktfall.
3. Förfina återhämtningsflöde vid sync-fel (offline-kö finns; lägg till konfliktöversikt och bättre replay-styrning).
4. Finjustera direkt AI-generering för planeringsspecifika output-mallar.
