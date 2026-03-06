import { GoogleGenAI, Type } from "@google/genai";

export interface Node {
  id: string;
  name: string;
  type: "deity" | "spirit" | "ritual" | "symbol" | "concept" | "place" | "creature" | "artifact" | "spell";
  description?: string;
}

export interface Link {
  source: string;
  target: string;
  relation: "associated_with" | "controls" | "appears_in" | "teaches" | "symbol_of";
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
}

const SYSTEM_INSTRUCTION = `
You are an expert in esoteric knowledge and graph database structures.
Your task is to extract entities and relationships from the provided text.

Entity Types:
- deity, spirit, ritual, symbol, concept, place, creature, artifact, spell

Relation Types:
- associated_with, controls, appears_in, teaches, symbol_of

INTELLIGENT ENTITY MERGING & SEMANTIC GROUPING RULES:
1. Normalize all names to their base/canonical form (e.g., "Hecate's" -> "Hecate", "Гекаты" -> "Геката").
2. SEMANTIC GROUPING: Recognize synonyms and semantically close concepts. Group them under a single canonical ID and Name.
   - Example: "wealth", "money magic", "attracting money", "prosperity" -> Use a single node (e.g., id: "money_magic", name: "Money Magic").
   - Example: "protection", "shielding", "warding" -> Use a single node (e.g., id: "protection_magic", name: "Protection").
3. You will be provided with a list of EXISTING NODES. If a new entity is semantically identical, a synonym, or a variation of an existing node, you MUST use the existing node's ID and Name.
4. Do not create duplicate nodes for the same concept. If the text mentions multiple forms of the same concept, extract it once.

Rules:
- id must be a short slug (lowercase, no spaces, e.g., "hecate", "money_magic")
- relation must be one of the specified types.
- Return ONLY a valid JSON object.
`;

export async function extractGraph(
  text: string, 
  language: 'en' | 'ru' = 'en', 
  isRitual: boolean = false,
  ritualName?: string,
  existingNodes: Node[] = []
): Promise<GraphData> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  
  const langInstruction = language === 'ru' 
    ? "Extract entity names in Russian. Use nominative case (именительный падеж)." 
    : "Extract entity names in English.";

  const existingNodesContext = existingNodes.length > 0
    ? `EXISTING NODES (Use these IDs and Names if they match): ${existingNodes.map(n => `${n.name} (id: ${n.id})`).join(", ")}`
    : "";

  const ritualInstruction = isRitual 
    ? `The provided text is a description of a ritual named "${ritualName || 'Unknown Ritual'}". 
       Create a central node for this ritual with type "ritual". 
       Extract all other entities mentioned and create links FROM them TO this ritual node using "appears_in" or "associated_with" relations.
       Ensure the ritual node contains the full text in its 'description' field.`
    : "Extract general entities and relations.";

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: text,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION + "\n" + langInstruction + "\n" + ritualInstruction + "\n" + existingNodesContext,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nodes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                type: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ["id", "name", "type"],
            },
          },
          links: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING },
                target: { type: Type.STRING },
                relation: { type: Type.STRING },
              },
              required: ["source", "target", "relation"],
            },
          },
        },
        required: ["nodes", "links"],
      },
    },
  });

  const content = response.text;
  if (!content) throw new Error("No response from Gemini");
  
  return JSON.parse(content) as GraphData;
}
