'use server';
import { PaidTierNames, subscriptionTiers } from "@/data/subscriptionTiers";
import { auth, currentUser, User } from "@clerk/nextjs/server";
import { getUserSubscription } from "../db/subscription";
import { Stripe } from "stripe";
import { env as serverEnv } from "@/data/env/server";
import { env as clientEnv } from "@/data/env/client";
import { redirect } from "next/navigation";

const stripe = new Stripe(serverEnv.STRIPE_SECRET_KEY);


export async function createCancelSession() {
  console.log('createCancelSession 01');
  const user = await currentUser()
  if (user == null) return { error: true }

  const subscription = await getUserSubscription(user.id)

  if (subscription == null) return { error: true }

  if (
    subscription.stripeCustomerId == null ||
    subscription.stripeSubscriptionId == null
  ) {
    return new Response(null, { status: 500 })
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${clientEnv.NEXT_PUBLIC_SERVER_URL}/dashboard/subscription`,
    flow_data: {
      type: "subscription_cancel",
      subscription_cancel: {
        subscription: subscription.stripeSubscriptionId,
      },
    },
  })

  redirect(portalSession.url)
}

export async function createCustomerPortalSession() {
  console.log('createCustomerPortalSession 02');
  
  const { userId } = await auth()

  if (userId == null) return { error: true }

  const subscription = await getUserSubscription(userId)

  if (subscription?.stripeCustomerId == null) {
    return { error: true }
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${clientEnv.NEXT_PUBLIC_SERVER_URL}/dashboard/subscription`,
  })

  redirect(portalSession.url)
}

export async function createCheckoutSession(tier: PaidTierNames) {
  console.log('createCheckoutSession 03', tier);
  const user = await currentUser();
  if (user == null) return { error: true };
  
  const subscription = await getUserSubscription(user.id);
  console.log('subscription', subscription);
  
  if (subscription == null) return { error: true };
  
  if (subscription.stripeCustomerId == null) {
    console.log('subscription.stripeCustomerId 04', subscription.stripeCustomerId);
    const url = await getCheckoutSession(tier, subscription, user);
    console.log('url', url);
    
    if (url == null) return { error: true };
    redirect(url);
  } else {
    console.log('subscription.stripeCustomerId 05', subscription.stripeCustomerId);
    const url = await getSubscriptionUpgradeSession(tier, subscription)
    console.log('url', url);
    
    redirect(url)
  }
}

async function getCheckoutSession(
  tier: PaidTierNames,
  subscription: {
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  },
  user: User
) {
  console.log('getCheckoutSession 04');
    const checkoutSession = await stripe.checkout.sessions.create({
        customer_email: user.primaryEmailAddress?.emailAddress,
        subscription_data: {
            metadata: {
                clerkUserId: user.id,
            }
        },
        line_items: [
            {
                price: subscriptionTiers[tier].stripePriceId,
                quantity: 1,
            }
        ],
        mode: "subscription",
        success_url: `${clientEnv.NEXT_PUBLIC_SERVER_URL}/dashboard/subscription`,
        cancel_url: `${clientEnv.NEXT_PUBLIC_SERVER_URL}/dashboard/subscription`,
    })

    return checkoutSession.url
};
async function getSubscriptionUpgradeSession(
  tier: PaidTierNames,
  subscription: {
    stripeCustomerId: string | null
    stripeSubscriptionId: string | null
    stripeSubscriptionItemId: string | null
  }
) {
  console.log('getSubscriptionUpgradeSession 05->', subscription);
  if (
    subscription.stripeCustomerId == null ||
    subscription.stripeSubscriptionId == null ||
    subscription.stripeSubscriptionItemId == null
  ) {
    console.log('getSubscriptionUpgradeSession 06 Error ***');
    throw new Error()
  }
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${clientEnv.NEXT_PUBLIC_SERVER_URL}/dashboard/subscription`,
    flow_data: {
      type: "subscription_update_confirm",
      subscription_update_confirm: {
        subscription: subscription.stripeSubscriptionId,
        items: [
          {
            id: subscription.stripeSubscriptionItemId,
            price: subscriptionTiers[tier].stripePriceId,
            quantity: 1,
          },
        ],
      },
    },
  })

  return portalSession.url
}