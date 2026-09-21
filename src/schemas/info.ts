import { z } from "zod";
import type { AccountInfo, LuckyNumber } from "../types/info.js";

export const accountInfoSchema: z.ZodType<AccountInfo> = z
  .object({
    Me: z.object({
      Account: z.object({
        Id: z.number(),
        UserId: z.number(),
        FirstName: z.string(),
        LastName: z.string(),
        Email: z.string(),
        Login: z.string(),
        GroupId: z.number(),
        IsActive: z.boolean(),
        IsPremium: z.boolean(),
        IsPremiumDemo: z.boolean(),
        ExpiredPremiumDate: z.number(),
        PremiumAddons: z.array(z.string()).optional().default([]),
      }),
      Class: z.object({
        Id: z.number(),
      }),
    }),
  })
  .transform(
    (raw): AccountInfo => ({
      id: raw.Me.Account.Id,
      userId: raw.Me.Account.UserId,
      firstName: raw.Me.Account.FirstName,
      lastName: raw.Me.Account.LastName,
      email: raw.Me.Account.Email,
      login: raw.Me.Account.Login,
      groupId: raw.Me.Account.GroupId,
      isActive: raw.Me.Account.IsActive,
      isPremium: raw.Me.Account.IsPremium,
      isPremiumDemo: raw.Me.Account.IsPremiumDemo,
      premiumExpiresAt: new Date(raw.Me.Account.ExpiredPremiumDate * 1000),
      premiumAddons: raw.Me.Account.PremiumAddons,
      classId: raw.Me.Class.Id,
    })
  );

export const luckyNumberSchema: z.ZodType<LuckyNumber> = z
  .object({
    LuckyNumber: z.object({
      LuckyNumber: z.number(),
      LuckyNumberDay: z.string(),
    }),
  })
  .transform(
    (raw): LuckyNumber => ({
      number: raw.LuckyNumber.LuckyNumber,
      day: raw.LuckyNumber.LuckyNumberDay,
    })
  );
