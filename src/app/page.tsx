import {
  previewFixture,
  type PreviewFixture,
} from "@/features/preview/fixture";

export function PreviewPage({
  fixture,
}: {
  fixture: PreviewFixture | null;
}) {
  if (!fixture) {
    return (
      <main>
        <p role="alert">Preview unavailable</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Chapter reviewer preview</h1>
      <p>
        {fixture.novelTitle} - Chapter {fixture.chapter.ordinal}
      </p>
    </main>
  );
}

export default function Page() {
  return <PreviewPage fixture={previewFixture} />;
}
