'use client';

import { useState } from 'react';
import SimchaSelector from './SimchaSelector';

export default function CTAButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="silver-btn" onClick={() => setOpen(true)}>
        Choose a Template
      </button>
      <SimchaSelector forceOpen={open} onClose={() => setOpen(false)} hideButton />
    </>
  );
}
