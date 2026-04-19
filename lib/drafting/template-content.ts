import { TEMPLATE_TYPES, type TemplateType } from "@/lib/ai/provider";

interface TemplateDetails {
  label: string;
  pickerLabel: string;
  eyebrow: string;
  summary: string;
  cardDescription: string;
  emptyStateHint: string;
  placeholder: string;
}

export const TEMPLATE_DETAILS: Record<TemplateType, TemplateDetails> = {
  incidentrapport: {
    label: "Incidentrapport",
    pickerLabel: "Incidentrapport",
    eyebrow: "DF Respons-läge",
    summary: "Kort, saklig fältstruktur för anmälan, åtgärder och uppföljning.",
    cardDescription:
      "Objektiv dokumentation i ett DF Respons-inspirerat upplägg som är lätt att klistra in och arbeta vidare med.",
    emptyStateHint:
      "När utkastet är klart får du en rak fältstruktur för händelse, åtgärder och uppföljning.",
    placeholder: `Exempeltext: "Clara drog Anna i håret under mattelektionen och kallade henne sedan för hora. Jag avbröt situationen direkt, pratade med båda eleverna och informerade mentor efter lektionen."

Välj Incidentrapport och klicka "Generera" för att få ett sakligt utkast med tydliga fält.`,
  },
  larlogg: {
    label: "Lärlogg",
    pickerLabel: "Lärlogg",
    eyebrow: "Lärloggsläge",
    summary: "Pedagogisk dokumentation med observation, analys och nästa steg.",
    cardDescription:
      "Styrkebaserad dokumentation för lärande, utveckling och framåtsyftande stöd i vardagen.",
    emptyStateHint:
      "Här visas en lärlogg som går att justera vidare innan du delar den internt eller med vårdnadshavare.",
    placeholder: `Exempeltext: "Under arbetet med bråk kunde eleven förklara hur hen tänkte när uppgiften blev svårare. Eleven bad om stöd vid jämförelser men visade god uthållighet och tog hjälp av konkret material."

Välj Lärlogg och klicka "Generera" för att få en tydlig observation, analys och ett nästa steg.`,
  },
  unikum: {
    label: "Unikum",
    pickerLabel: "Unikum",
    eyebrow: "Unikum-läge",
    summary: "Kompakt dokumentation med sammanhang, lärande och nästa steg i Unikum-ton.",
    cardDescription:
      "Ett kopieringsvänligt utkast för Unikum med fokus på sammanhang, det vi såg och hur arbetet går vidare.",
    emptyStateHint:
      "När texten är klar får du ett Unikum-anpassat upplägg med korta fält som är enkla att klistra in.",
    placeholder: `Exempeltext: "I arbetet med berättande text deltog eleven aktivt i planeringen och kunde muntligt beskriva en tydlig början och ett problem i berättelsen. Eleven behöver fortsatt stöd för att utveckla avslut och binda ihop händelser."

Välj Unikum och klicka "Generera" för att få ett utkast med lärande, mål och nästa steg.`,
  },
  veckobrev: {
    label: "Veckobrev",
    pickerLabel: "Veckobrev",
    eyebrow: "Informationsläge",
    summary: "Varm, tydlig gruppinformation till vårdnadshavare med lugn struktur.",
    cardDescription:
      "Tydlig kommunikation till vårdnadshavare om veckan som gått, nästa vecka och praktisk information.",
    emptyStateHint:
      "Här visas ett veckobrev med lagom varm ton, tydliga rubriker och praktisk information.",
    placeholder: `Exempeltext: "Den här veckan har klassen arbetat med vikingatiden i SO och fortsatt träna multiplikation i matematik. Gruppen har samarbetat fint under stationsarbetet. Nästa vecka fortsätter vi med läsförståelse och idrott utomhus på onsdag."

Välj Veckobrev och klicka "Generera" för att få en färdig text till vårdnadshavare.`,
  },
  custom: {
    label: "Eget dokument",
    pickerLabel: "Eget dokument",
    eyebrow: "Fritt utkast",
    summary: "Ett mer öppet dokumentläge när du behöver ett professionellt utkast utan fast mall.",
    cardDescription:
      "Flexibelt läge för sammanfattningar, minnesanteckningar och andra skolrelaterade dokumentutkast.",
    emptyStateHint:
      "Här visas ett bearbetat utkast som du kan kopiera vidare till ditt eget arbetsflöde.",
    placeholder: `Exempeltext: "Efter samtalet med eleven och vårdnadshavare kom vi överens om att följa upp arbetsron om två veckor. Eleven uttryckte att instruktionerna ibland känns otydliga vid längre uppgifter och önskar tätare avstämningar."

Välj Eget dokument och klicka "Generera" för att få ett sakligt och användbart utkast.`,
  },
};

export const TEMPLATE_OPTIONS = TEMPLATE_TYPES.map((value) => ({
  value,
  label: TEMPLATE_DETAILS[value].pickerLabel,
}));

export function isTemplateType(value: string): value is TemplateType {
  return (TEMPLATE_TYPES as readonly string[]).includes(value);
}
