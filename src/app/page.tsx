import {
  previewFixture,
  type PreviewFixture,
} from "@/features/preview/fixture";
import { PreviewChapterReviewer } from "@/features/reviewer/PreviewChapterReviewer";

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

  return <PreviewChapterReviewer fixture={fixture} />;
}

export default function Page() {
  return <PreviewPage fixture={previewFixture} />;
}
