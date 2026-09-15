'use client';

import React from 'react';
import LoginPage from '../(auth)/login/page';

export default function FamiliaDirectPage() {
  return <LoginPage forceFamilyMode={true} />;
}
