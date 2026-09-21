export interface AccountInfo {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  login: string;
  groupId: number;
  isActive: boolean;
  isPremium: boolean;
  isPremiumDemo: boolean;
  premiumExpiresAt: Date;
  premiumAddons: string[];
  classId: number;
}

export interface LuckyNumber {
  number: number;
  day: string;
}
