// Mock database implementation
export function createMockDatabase() {
  const mockData = {
    users: new Map(),
    pricingPlans: getDefaultPricingPlans(),
    subscriptions: new Map(),
    usage: new Map(),
    posts: new Map(),
  };

  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([]),
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
    insert: () => ({
      into: () => ({
        values: () => Promise.resolve([]),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
  };
}

export function getDefaultPricingPlans() {
  return [
    {
      id: 'free-plan',
      cardTitle: 'Free Plan',
      cardDescription: 'Perfect for getting started',
      price: '0',
      currency: 'USD',
      displayPrice: 'Free',
      features: ['Basic features', 'Limited usage'],
      isActive: true,
      environment: 'live',
      displayOrder: 1,
    },
  ];
}