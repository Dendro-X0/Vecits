"use client";

import { useEffect, useState } from "react";

type CarouselItem = {
  title: string;
  value: string;
  label: string;
};

const ITEMS: CarouselItem[] = [
  {
    title: "More than a marketplace shell",
    value: "Protocol",
    label: "Settlement without fiat rails or platform override"
  },
  {
    title: "Alignment over ads",
    value: "No funnel",
    label: "Discovery ranks fit — not traffic games or promoted slots"
  },
  {
    title: "Portable identity",
    value: "Ed25519",
    label: "Your key is your account across nodes and community stores"
  },
  {
    title: "Kernel-confirmed truth",
    value: "Replay",
    label: "Escrow, delivery, and reputation from honest event replay"
  }
];

export function AuthCarousel() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((prev) => (prev + 1) % ITEMS.length);
        setVisible(true);
      }, 220);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const item = ITEMS[index];

  return (
    <div className="flex flex-1 flex-col justify-between">
      <div className="flex flex-1 items-center justify-center">
        <div className="relative w-full max-w-2xl px-4">
          <h2
            className={`text-balance text-4xl font-semibold leading-tight tracking-tight text-white transition-all duration-300 md:text-5xl ${
              visible ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0"
            }`}
          >
            {item.title}
          </h2>

          <div className="mt-12">
            <div className="overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-3 shadow-2xl backdrop-blur-md">
              <div className="group relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-slate-700/20">
                <div className="absolute inset-0 opacity-40 mix-blend-overlay transition-transform duration-1000 group-hover:scale-110">
                  <div className="absolute left-[-10%] top-[-10%] h-[50%] w-[50%] rounded-full bg-sky-400 blur-[80px]" />
                  <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-indigo-400 blur-[80px]" />
                </div>

                <div className="absolute inset-0 flex items-center justify-center p-8">
                  <div
                    className={`text-center transition-all duration-300 ${
                      visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
                    }`}
                  >
                    <p className="bg-gradient-to-br from-white to-white/40 bg-clip-text text-5xl font-bold tracking-tighter text-transparent md:text-7xl">
                      {item.value}
                    </p>
                    <p className="mt-4 text-sm font-medium uppercase tracking-widest text-white/60">
                      {item.label}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex justify-center gap-2 lg:justify-start">
        {ITEMS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setVisible(false);
              window.setTimeout(() => {
                setIndex(i);
                setVisible(true);
              }, 180);
            }}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index ? "w-8 bg-sky-400" : "w-1.5 bg-white/20 hover:bg-white/35"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
