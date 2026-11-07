"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

const CONTAINER_ID = "GTM-M48LGKSS";
const PUBLIC_PAGE = /^\/(?:$|(?:rankings|weekly)\/?$|(?:soccer|baseball|lol|epl|kleague|kbo|lck)(?:\/[a-z0-9]+)?\/?$|player\/[a-z0-9]+\/?$)/i;

export default function GoogleTagManager() {
  const pathname = usePathname();
  const lastPage = useRef("");
  const started = useRef(false);
  const isPublicPage = PUBLIC_PAGE.test(pathname);

  useEffect(() => {
    if (!isPublicPage) {
      lastPage.current = "";
      return;
    }

    const pageLocation = window.location.origin + pathname;
    if (lastPage.current === pageLocation) return;

    const dataLayer = (window.dataLayer ??= []);
    if (!started.current) {
      dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      started.current = true;
    }

    dataLayer.push({
      event: "fanarena_page_view",
      page_location: pageLocation,
      page_referrer: lastPage.current || (document.referrer ? new URL(document.referrer).origin : ""),
    });
    lastPage.current = pageLocation;
  }, [isPublicPage, pathname]);

  if (!isPublicPage) return null;

  return (
    <Script
      id="fanarena-tag-manager"
      src={`https://www.googletagmanager.com/gtm.js?id=${CONTAINER_ID}`}
      strategy="afterInteractive"
    />
  );
}
