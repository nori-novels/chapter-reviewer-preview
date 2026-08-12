export function copyToClipboard(value: string): void {
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(value).then(
      () => {},
      () => {},
    );
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } catch {}
  document.body.removeChild(textarea);
}
