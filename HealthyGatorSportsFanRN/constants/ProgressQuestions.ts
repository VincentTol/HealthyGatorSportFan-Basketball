export type ProgressQuestion = {
  question_id: string;
  question: string;
  min_chars: number;
};

const progressQuestionsData = require('./progressQuestions.json');

const isProgressQuestion = (value: any): value is ProgressQuestion => {
  return (
    value &&
    typeof value.question_id === 'string' &&
    typeof value.question === 'string' &&
    Number.isInteger(value.min_chars)
  );
};

export const DEFAULT_PROGRESS_QUESTIONS: ProgressQuestion[] = Array.isArray(progressQuestionsData)
  ? progressQuestionsData.filter(isProgressQuestion)
  : [];
