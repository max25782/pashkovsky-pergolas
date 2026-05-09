'use client';

import { useEffect } from 'react';

export default function ScrollAnimationInit() {
  useEffect(() => {
    const vh = window.innerHeight;
    const elements = document.querySelectorAll<HTMLElement>('.animate-on-scroll');

    // Mark viewport elements as in-view FIRST, before adding js-ready,
    // so there is no frame where they're hidden
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < vh && rect.bottom > 0) {
        el.classList.add('in-view');
      }
    });

    // Now safe to enable CSS animations for off-screen elements
    document.documentElement.classList.add('js-ready');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    elements.forEach((el) => {
      if (!el.classList.contains('in-view')) {
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
