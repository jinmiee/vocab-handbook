import vocabData from 'src/data/vocab.json';
import VocabDetailClient from 'src/components/VocabDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return vocabData.map((item) => ({
    id: item.id,
  }));
}

export default async function VocabDetail({ params }: PageProps) {
  const { id } = await params;
  const vocabIndex = vocabData.findIndex((item) => item.id === id);
  const currentVocab = vocabIndex !== -1 ? vocabData[vocabIndex] : null;

  if (!currentVocab) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-6 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-slate-300 mb-3 mx-auto">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <h3 className="font-bold text-slate-700 text-lg">단어를 찾을 수 없습니다</h3>
      </div>
    );
  }

  const prevVocab = vocabIndex > 0 ? vocabData[vocabIndex - 1] : null;
  const nextVocab = vocabIndex < vocabData.length - 1 ? vocabData[vocabIndex + 1] : null;

  return (
    <VocabDetailClient
      currentVocab={currentVocab}
      prevVocab={prevVocab}
      nextVocab={nextVocab}
      vocabIndex={vocabIndex}
      totalCount={vocabData.length}
    />
  );
}
