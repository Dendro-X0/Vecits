/** Scroll container for help pages — desktop shell or viewport. */
export function getHelpScrollRoot(): Element | null {
  if (typeof document === "undefined") {
    return null;
  }
  return document.querySelector(".desktop-shell-content");
}
