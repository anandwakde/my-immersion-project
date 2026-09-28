import { AnchorHTMLAttributes, MouseEvent } from "react";
import { navigate } from "@/lib/router";

// An <a> that navigates in-app on a plain left click, but still behaves
// like a normal link for cmd/ctrl/middle-click (open in new tab) and for
// target="_blank".
export function Link({ href, onClick, target, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      target === "_blank"
    ) {
      return;
    }
    e.preventDefault();
    navigate(href);
  }
  return <a href={href} target={target} onClick={handleClick} {...rest} />;
}
