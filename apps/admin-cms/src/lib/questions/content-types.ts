export interface QuestionInput {
  part: number;
  type: string;
  questionText: string;
  difficulty: string;
  correctOption: string;
  explanation: string | null;
  transcript: string | null;
  groupId: string | null;
  positionInGroup: number | null;
  options: { optionCode: string; optionText: string }[];
  tags: string[];
}

export interface BankQuestion {
  id: string;
  audioUrl: string | null;
  imageUrl: string | null;
  input: QuestionInput;
}

export interface BankGroup {
  id: string;
  audioUrl: string | null;
  part: number;
  type: string;
  instruction: string;
  passageText: string;
  transcript: string;
  assets: {
    kind: string;
    url: string | null;
    storageKey: string | null;
    content: string | null;
    orderNo: number;
  }[];
  questionIds: string[];
  audioKey: string | null;
  isComplete: boolean;
}
