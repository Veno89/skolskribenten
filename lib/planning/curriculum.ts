export type PlanningGradeBand = "7-9";

export type PlanningSubjectId = "historia" | "religion" | "samhallskunskap";

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
];

export function getSubjectCurriculum(subjectId: PlanningSubjectId): SubjectCurriculum | undefined {
  return SUBJECT_CURRICULUM.find((subject) => subject.id === subjectId);
}

export function getPlanningArea(subjectId: PlanningSubjectId, areaId: string): PlanningArea | undefined {
  return getSubjectCurriculum(subjectId)?.areas.find((area) => area.id === areaId);
}
