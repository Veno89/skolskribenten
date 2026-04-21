export const PLANNING_GRADE_BANDS = ["F-3", "4-6", "7-9"] as const;

export type PlanningGradeBand = (typeof PLANNING_GRADE_BANDS)[number];

export type PlanningSubjectId =
  | "historia"
  | "religion"
  | "samhallskunskap"
  | "svenska"
  | "matematik"
  | "engelska"
  | "biologi";

export interface CurriculumItem {
  id: string;
  label: string;
  guidance: string;
}

export interface PlanningArea {
  id: string;
  title: string;
  description: string;
  items: CurriculumItem[];
}

export interface SubjectCurriculum {
  id: PlanningSubjectId;
  label: string;
  gradeBand: PlanningGradeBand;
  areas: PlanningArea[];
}

export const SUBJECT_CURRICULUM: SubjectCurriculum[] = [
  {
    id: "svenska",
    label: "Svenska",
    gradeBand: "F-3",
    areas: [
      {
        id: "las-och-skrivstart",
        title: "Läs- och skrivstart",
        description:
          "Kartläggning av tidiga undervisningsspår i svenska för att bygga avkodning, språkförståelse och skrivlust i F-3.",
        items: [
          {
            id: "sv-f3-fonologisk-medvetenhet",
            label: "Fonologisk medvetenhet, bokstavskännedom och koppling mellan ljud och bokstav",
            guidance:
              "Varva gemensamma språklekspass med korta, tydliga övningar där eleverna får höra, säga och skriva.",
          },
          {
            id: "sv-f3-lasstrategier",
            label: "Enkla lässtrategier före, under och efter läsning av elevnära texter",
            guidance:
              "Modellera hur man förutspår, ställer frågor och sammanfattar med stöd av bilder och samtal.",
          },
          {
            id: "sv-f3-skriva-enkla-texter",
            label: "Att skriva enkla berättande och faktainriktade texter med stödstrukturer",
            guidance:
              "Arbeta med gemensamt skrivande, bildstöd och tydliga textmallar innan eleverna skriver mer självständigt.",
          },
          {
            id: "sv-f3-muntlig-framstallning",
            label: "Muntligt berättande, återberättande och samtal i olika sammanhang",
            guidance:
              "Planera in EPA, bildsamtal och återberättande där eleverna tränar turtagning och tydlighet.",
          },
          {
            id: "sv-f3-respons",
            label: "Respons och bearbetning av texter med fokus på innehåll, ordval och enkel struktur",
            guidance:
              "Låt eleverna få kort, konkret respons och pröva att förbättra en sak i taget.",
          },
        ],
      },
    ],
  },
  {
    id: "matematik",
    label: "Matematik",
    gradeBand: "4-6",
    areas: [
      {
        id: "brak-och-representationer",
        title: "Bråk, decimaltal och representationer",
        description:
          "Översikt över centrala innehållsspår i matematik 4-6 kopplade till taluppfattning, representationer och resonemang.",
        items: [
          {
            id: "ma-46-brak-begrepp",
            label: "Bråk som del av helhet, del av antal och tal på tallinjen",
            guidance:
              "Växla mellan konkret material, bilder och symboler så att eleverna möter samma idé i flera representationer.",
          },
          {
            id: "ma-46-jamfora-tal",
            label: "Jämföra och ordna bråk, decimaltal och enkla procentuttryck",
            guidance:
              "Låt eleverna motivera jämförelser muntligt och skriftligt med stöd av tallinje och modeller.",
          },
          {
            id: "ma-46-raknestrategier",
            label: "Strategier och metoder för beräkningar med rationella tal i elevnära uppgifter",
            guidance:
              "Synliggör flera lösningsvägar och diskutera när olika metoder är effektiva eller mindre effektiva.",
          },
          {
            id: "ma-46-problemlosning",
            label: "Problemlösning där eleverna väljer metod, prövar och omprövar",
            guidance:
              "Ge problem med låg tröskel och hög takhöjd där eleverna får förklara hur de tänker och varför.",
          },
          {
            id: "ma-46-resonemang-kommunikation",
            label: "Matematiska resonemang och kommunikation med begrepp, bilder och symboler",
            guidance:
              "Bygg in stopp för kamratförklaringar, exit tickets och korta resonemang i helklass.",
          },
        ],
      },
    ],
  },
  {
    id: "engelska",
    label: "Engelska",
    gradeBand: "4-6",
    areas: [
      {
        id: "muntlig-kommunikation",
        title: "Muntlig kommunikation och strategier",
        description:
          "Planeringsstöd för engelska 4-6 med fokus på att förstå, våga uttrycka sig och använda kommunikativa strategier.",
        items: [
          {
            id: "en-46-lyssna-forsta",
            label: "Lyssna och förstå tydligt talad engelska i elevnära situationer",
            guidance:
              "Arbeta med korta hörövningar, upprepning och tydliga lyssnaruppdrag som fångar huvudbudskap och detaljer.",
          },
          {
            id: "en-46-muntlig-produktion",
            label: "Muntlig produktion i vardagliga och bekanta ämnesområden",
            guidance:
              "Ge eleverna fraser, samtalsstöd och trygg repetition innan mer fria samtal eller redovisningar.",
          },
          {
            id: "en-46-strategier",
            label: "Strategier för att göra sig förstådd och förstå andra när språket inte räcker till",
            guidance:
              "Modellera omskrivningar, följdfrågor, kroppsspråk och hur man ber om förtydligande.",
          },
          {
            id: "en-46-texter-medier",
            label: "Möte med sånger, filmer, dialoger och andra elevnära texter i olika medier",
            guidance:
              "Koppla innehållet till intresseväckande teman där eleverna både lyssnar, läser och reagerar på innehåll.",
          },
          {
            id: "en-46-anpassa-sprak",
            label: "Anpassa språk och uttryck efter mottagare, situation och syfte",
            guidance:
              "Låt eleverna öva på samma budskap i olika sammanhang, till exempel fråga, berätta och instruera.",
          },
        ],
      },
    ],
  },
  {
    id: "historia",
    label: "Historia",
    gradeBand: "7-9",
    areas: [
      {
        id: "industriella-revolutionen",
        title: "Industriella revolutionen",
        description:
          "Kartläggning av centrala innehållsmoment för planering i historia (7-9).",
        items: [
          {
            id: "historia-industrial-orsaker",
            label: "Orsaker till den industriella revolutionen i Storbritannien och Europa",
            guidance:
              "Låt eleverna analysera tekniska, ekonomiska och samhälleliga orsaker med källstöd.",
          },
          {
            id: "historia-industrial-konsekvenser",
            label: "Konsekvenser för levnadsvillkor, arbete, urbanisering och klasskillnader",
            guidance:
              "Arbeta med jämförelser mellan grupper och diskutera både förbättringar och risker.",
          },
          {
            id: "historia-industrial-sverige",
            label: "Sveriges industrialisering och omvandlingen till ett modernt samhälle",
            guidance:
              "Knyt till migration, utbildning, demokratisering och framväxten av välfärdsstat.",
          },
          {
            id: "historia-industrial-kallor",
            label: "Historiska källor om industrialismen och kritisk granskning",
            guidance:
              "Låt eleverna granska trovärdighet, tendens och perspektiv i historiska källor.",
          },
          {
            id: "historia-industrial-nutid",
            label: "Samband mellan industrialiseringens arv och dagens hållbarhetsfrågor",
            guidance:
              "Arbeta med kontinuitet/förändring och koppla historiska mönster till nutida samhällsfrågor.",
          },
        ],
      },
    ],
  },
  {
    id: "religion",
    label: "Religionskunskap",
    gradeBand: "7-9",
    areas: [
      {
        id: "terminsavstamning",
        title: "Terminens innehållscheck",
        description:
          "Översiktlig kontroll av vanliga centrala innehållsspår i religionskunskap (7-9).",
        items: [
          {
            id: "religion-livsfragor",
            label: "Livsfrågor och identitet i relation till religion och livsåskådning",
            guidance:
              "Planera moment där eleverna får resonera om identitet, mening och etiska vägval.",
          },
          {
            id: "religion-varldsreligioner",
            label: "Centrala tankegångar, uttryck och urkunder i världsreligionerna",
            guidance:
              "Låt eleverna jämföra likheter/skillnader i tro, ritualer och traditioner.",
          },
          {
            id: "religion-samhalle",
            label: "Religioners roll i samhälle, konflikter och fredsarbete",
            guidance:
              "Arbeta med konkreta fall som visar religion i samspel med politik och samhällsutveckling.",
          },
          {
            id: "religion-etikmodeller",
            label: "Etiska begrepp och modeller för resonemang i vardag och samhälle",
            guidance:
              "Bygg upp övningar där eleverna tränar etiska argument med olika perspektiv.",
          },
          {
            id: "religion-kallkritik",
            label: "Källkritik och granskning av information om religion i digitala miljöer",
            guidance:
              "Låt eleverna värdera avsändare, syfte och möjliga förenklingar i digitala källor.",
          },
        ],
      },
    ],
  },
  {
    id: "samhallskunskap",
    label: "Samhällskunskap",
    gradeBand: "7-9",
    areas: [
      {
        id: "demokrati-och-beslutsprocesser",
        title: "Demokrati och beslutsprocesser",
        description:
          "Översiktlig innehållscheck i samhällskunskap (7-9) för demokrati, rättigheter och medier.",
        items: [
          {
            id: "sh-demokrati-system",
            label: "Sveriges demokratiska system och politiska beslutsprocesser på lokal och nationell nivå",
            guidance:
              "Låt eleverna följa ett konkret beslut från förslag till genomförande och reflektera över påverkan.",
          },
          {
            id: "sh-rattigheter-skyldigheter",
            label: "Demokratiska fri- och rättigheter samt individens ansvar i samhället",
            guidance:
              "Arbeta med elevnära dilemman där rättigheter och skyldigheter behöver vägas mot varandra.",
          },
          {
            id: "sh-medier-kallkritik",
            label: "Mediers roll, informationspåverkan och källkritik i digitala miljöer",
            guidance:
              "Bygg övningar i avsändargranskning, budskapstolkning och faktakontroll i aktuella medieflöden.",
          },
          {
            id: "sh-ekonomi-vardag",
            label: "Privatekonomi, konsumtion och hållbara val i vardag och samhälle",
            guidance:
              "Knyt budget, konsumtionsval och samhällsekonomiska konsekvenser till elevernas vardag.",
          },
          {
            id: "sh-intressekonflikter",
            label: "Intressekonflikter i samhällsfrågor och argumentation utifrån olika perspektiv",
            guidance:
              "Låt eleverna träna saklig argumentation med tydlig koppling till flera perspektiv och källor.",
          },
        ],
      },
    ],
  },
  {
    id: "biologi",
    label: "Biologi",
    gradeBand: "7-9",
    areas: [
      {
        id: "ekologi-och-hallbarhet",
        title: "Ekologi och hållbar utveckling",
        description:
          "Översiktlig kontroll av vanliga innehållsspår i biologi 7-9 kring ekosystem, samband i naturen och hållbarhetsfrågor.",
        items: [
          {
            id: "bi-79-ekosystem",
            label: "Samband i ekosystem mellan organismer, näringskedjor och näringsvävar",
            guidance:
              "Låt eleverna undersöka hur förändringar i en del av ett system påverkar andra delar och motivera sina slutsatser.",
          },
          {
            id: "bi-79-faltstudier",
            label: "Fältstudier, observationer och dokumentation av naturmiljöer",
            guidance:
              "Planera in praktiska inslag där eleverna samlar data, jämför resultat och tränar biologiska begrepp i verkliga miljöer.",
          },
          {
            id: "bi-79-manniskans-paverkan",
            label: "Människans påverkan på naturen och hur val i samhället kan kopplas till hållbar utveckling",
            guidance:
              "Arbeta med aktuella fall där eleverna får väga miljömässiga, sociala och ekonomiska perspektiv mot varandra.",
          },
          {
            id: "bi-79-biologiska-begrepp",
            label: "Användning av biologiska begrepp, modeller och förklaringar i resonemang",
            guidance:
              "Bygg upp undervisningen så att eleverna får gå från vardagsspråk till mer ämnesspecifika förklaringar med stödstrukturer.",
          },
          {
            id: "bi-79-atgarder-framtid",
            label: "Diskussion om åtgärder, ansvar och framtida handlingsalternativ i hållbarhetsfrågor",
            guidance:
              "Ge uppgifter där eleverna jämför olika lösningar och motiverar vilka konsekvenser de kan få på kort och lång sikt.",
          },
        ],
      },
    ],
  },
];

export function getSubjectCurriculum(subjectId: PlanningSubjectId): SubjectCurriculum | undefined {
  return SUBJECT_CURRICULUM.find((subject) => subject.id === subjectId);
}

export function getSubjectsForGradeBand(gradeBand: PlanningGradeBand): SubjectCurriculum[] {
  return SUBJECT_CURRICULUM.filter((subject) => subject.gradeBand === gradeBand);
}

export function getPlanningArea(subjectId: PlanningSubjectId, areaId: string): PlanningArea | undefined {
  return getSubjectCurriculum(subjectId)?.areas.find((area) => area.id === areaId);
}
