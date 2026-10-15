let pendingClientId: string | null = null;
let pendingBarberId: string | null = null;

export const setClientSearchFocus = (clientId: string) => { pendingClientId = clientId; };
export const consumeClientSearchFocus = () => {
  const id = pendingClientId;
  pendingClientId = null;
  return id;
};

export const setBarberSearchFocus = (barberId: string) => { pendingBarberId = barberId; };
export const consumeBarberSearchFocus = () => {
  const id = pendingBarberId;
  pendingBarberId = null;
  return id;
};
