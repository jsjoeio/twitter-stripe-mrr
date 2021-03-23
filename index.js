require("dotenv").config()
const stripe = require("stripe")(process.env.STRIPE_API_KEY)
const { getUnixTime, endOfMonth, startOfMonth } = require("date-fns")

const Twitter = require("twitter")
// NOTE: doesn't seem like stripe-node supports Deno yet sadly
// https://github.com/stripe/stripe-node/issues/997
// const stripe = new Stripe(
//   "pk_test_51INJxZFKmQcPTDII3uCy73sp4ZQseDhWCM02QmmyFh2J0lcWibnXqC8XjkfOHmHGIgi1wIeYaHw8sY2nxHo1sBUt00p07FPvr8"
// )

// Remember January is 0
// Get total for current month
const startRangeTimestamp = getUnixTime(new Date(startOfMonth(new Date())))
const endRangeTimestamp = getUnixTime(new Date(endOfMonth(new Date())))
const client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
})

// credit here: https://dev.to/deta/how-i-used-deta-and-the-twitter-api-to-update-my-profile-name-with-my-follower-count-tom-scott-style-l1j

async function getStripeRevenue(startRangeTimestamp, endRangeTimestamp) {
  const payouts = await stripe.payouts.list({
    created: { gte: startRangeTimestamp, lte: endRangeTimestamp },
    limit: 100, // Maximum limit (10 is default)
  })

  const amountTotal = payouts.data.reduce((a, b) => ({
    amount: a.amount + b.amount,
  })).amount

  return amountTotal
}

/**
 * @param {number} n - the progress towards goal out of 10
 * @example there are ten squares total, and n is 5, then it should return
 * "MRR: 0 🟩🟩🟩🟩🟩🟨⬜⬜⬜⬜  5K"
 */
function buildMRRSquaresForTwitter(n, goal) {
  const GOAL_AS_K = kFormatter(goal)
  let SQUARES = ""
  let count = 0

  // Add green squares
  for (let i = 0; i < n; i++) {
    SQUARES += "🟩"
    count += 1
  }

  // Add one after the last green for progress
  if (count !== 10) {
    SQUARES += "🟨"
    count += 1
  }

  // Fill the rest with white squares
  if (count !== 10) {
    for (let i = count; i < 10; i++) {
      SQUARES += "⬜"
      count += 1
    }
  }

  return `MRR: 0 ${SQUARES} ${GOAL_AS_K}`
}

// source: https://stackoverflow.com/a/9461657/3015595
function kFormatter(num) {
  return Math.abs(num) > 999
    ? Math.sign(num) * (Math.abs(num) / 1000).toFixed(1) + "K"
    : Math.sign(num) * Math.abs(num)
}

;(async function () {
  const totalRevenueForMonth = await getStripeRevenue(
    startRangeTimestamp,
    endRangeTimestamp
  )

  // let's assume my goal is $5k
  // and there are 10 squares to fill
  const GOAL = 5000
  const numOfTenRounded = ((totalRevenueForMonth / GOAL) * 10).toPrecision(1)

  const mrrSquares = buildMRRSquaresForTwitter(numOfTenRounded, GOAL)
  const params = {
    location: mrrSquares,
  }

  client.post("account/update_profile", params, (err) => {
    if (err) throw new Error("Failed to update profile")
    console.log("🎉 Success! Updated Twitter bio/location")
  })
})()
