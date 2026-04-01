export type ProgressQuestion = {
  question_id: string;
  question: string;
  min_chars: number;
  max_chars: number;
};

const progressQuestionsData = require('./progressQuestions.json');

const isProgressQuestion = (value: any): value is ProgressQuestion => {
  return (
    value &&
    typeof value.question_id === 'string' &&
    typeof value.question === 'string' &&
    Number.isInteger(value.min_chars) &&
    Number.isInteger(value.max_chars)
  );
};

export const DEFAULT_PROGRESS_QUESTIONS: ProgressQuestion[] = Array.isArray(progressQuestionsData)
  ? progressQuestionsData
      .filter((value: any) =>
        value &&
        typeof value.question_id === 'string' &&
        typeof value.question === 'string' &&
        Number.isInteger(value.min_chars)
      )
      .map((value: any) => ({
        question_id: value.question_id,
        question: value.question,
        min_chars: value.min_chars,
        max_chars: Number.isInteger(value.max_chars) ? value.max_chars : 250,
      }))
  : [];
