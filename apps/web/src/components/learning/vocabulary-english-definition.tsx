export function VocabularyEnglishDefinition({ definition }: { definition?: string | null }) {
  if (!definition) return null;

  return (
    <p className="vocabulary-english-definition" lang="en">
      <strong>English definition</strong>
      <span>{definition}</span>
    </p>
  );
}
