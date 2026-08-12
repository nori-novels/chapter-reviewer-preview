import { previewFixture } from "@/features/preview/fixture";

export default function Page() {
  return (
    <main>
      <h1>Chapter reviewer preview</h1>
      {previewFixture ? (
        <p>
          {previewFixture.novelTitle} - Chapter {previewFixture.chapter.ordinal}
        </p>
      ) : null}
    </main>
  );
}
