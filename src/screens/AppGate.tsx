import React, { useState } from 'react';
import { useAccess } from '../state/AccessContext';
import { TaxiProvider } from '../state/TaxiContext';
import { DashboardScreen } from './DashboardScreen';
import { AccessScreen } from './AccessScreen';
import { AdminAccessModal } from '../components/AdminAccessModal';

// The one place that decides whether the app is usable. TaxiProvider only mounts
// once access is approved, so nothing inside it -- trip state, socket sync, seat
// payments -- runs for a driver who has not paid.
export const AppGate: React.FC = () => {
  const { hasAccess, isLoading } = useAccess();
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  return (
    <>
      {isLoading || !hasAccess ? (
        <AccessScreen onOpenAdmin={() => setIsAdminOpen(true)} />
      ) : (
        <TaxiProvider>
          <DashboardScreen onOpenAccessAdmin={() => setIsAdminOpen(true)} />
        </TaxiProvider>
      )}

      <AdminAccessModal
        visible={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
      />
    </>
  );
};
