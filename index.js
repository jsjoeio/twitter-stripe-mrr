require("dotenv").config()
const stripe = require("stripe")(process.env.STRIPE_API_KEY)
const { getUnixTime, endOfMonth, startOfMonth } = require("date-fns")

const Twitter = require("twitter")

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
const iconsTypes = {
  square: { green: "🟩", yellow: "🟨", gray: "⬜" },
  circle: { green: "🟢", yellow: "🟡", gray: "⚪" },
}

const EXPECTED_ENV_VARS = [
  "TWITTER_CONSUMER_KEY",
  "TWITTER_CONSUMER_KEY",
  "TWITTER_ACCESS_TOKEN_KEY",
  "TWITTER_ACCESS_TOKEN_SECRET",
  "STRIPE_API_KEY",
]

async function getStripeRevenue(startRangeTimestamp, endRangeTimestamp) {
  // credit here: https://stackoverflow.com/a/53775391/3015595
  const payoutsInCents = await stripe.payouts.list({
    created: { gte: startRangeTimestamp, lte: endRangeTimestamp },
    limit: 100, // Maximum limit (10 is default)
  })

  // payouts returned by Stripe API are in cents, so we divide by 100
  const payouts = payoutsInCents.data.map(function (x) {
    return x.amount / 100
  })

  const amountTotal = payouts.reduce((a, b) => ({
    amount: a + b,
  })).amount

  return amountTotal
}

/**
 * @param {number} n - the progress towards goal out of 10
 * @param {string} icon - the progress Icon (square or circle)
 * @example there are ten squares total, and n is 5, then it should return
 * "MRR: 0 🟩🟩🟩🟩🟩🟨⬜⬜⬜⬜  5K" or "MRR: 0 🟢🟢🟢🟢🟢🟡⚪⚪⚪⚪  5K"
 */
function buildMRRSquaresForTwitter(n, goal, icon = "square") {
  const GOAL_AS_K = kFormatter(goal)
  let SQUARES = ""
  let count = 0

  // Add green squares
  for (let i = 0; i < n; i++) {
    SQUARES += iconsTypes[icon].green
    count += 1
  }

  // Add one after the last green for progress
  if (count !== 10) {
    SQUARES += iconsTypes[icon].yellow
    count += 1
  }

  // Fill the rest with white squares
  if (count !== 10) {
    for (let i = count; i < 10; i++) {
      SQUARES += iconsTypes[icon].gray
      count += 1
    }
  }

  return `MRR: 0 ${SQUARES} ${GOAL_AS_K}`
}

async function removeMe() {
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

  // credit here: https://dev.to/deta/how-i-used-deta-and-the-twitter-api-to-update-my-profile-name-with-my-follower-count-tom-scott-style-l1j
  client.post("account/update_profile", params, (err) => {
    if (err) throw new Error("Failed to update profile")
    console.log("🎉 Success! Updated Twitter bio/location")
  })
}

/**
 * The main function which starts the script
 */
async function main() {
  try {
    // Verify that all the environment variables are set
    const ACTUAL_ENV_VARS = EXPECTED_ENV_VARS.map((envVar) =>
      getEnvironmentVariable(envVar)
    )

    // validate Twitter API
    // validate Stripe API
  } catch (error) {
    console.error(error)
  }
}

main()

//////////////////////////////
// Helper Functions
/////////////////////////////

/**
 * Grabs the environment variable based off the name
 * @param {string} name the name of the variable
 * @returns {string} the variable if it exists or throws an error
 */
function getEnvironmentVariable(name) {
  if (!process.env[name]) {
    throw new Error(`❌ ERROR: could not find ${name} in your environment.`)
  }

  console.log(`✅ Found ${name} in environment.`)
  return process.env[name]
}

/**
 * Formats a number to have a K or not
 * @param {number} num the number to format
 * @returns {string} the `num` formatted with "K"
 * @example kFormatter(5000) => 5K
 * @link https://stackoverflow.com/a/9461657/3015595 for more information
 */
function kFormatter(num) {
  return Math.abs(num) > 999
    ? Math.sign(num) * (Math.abs(num) / 1000).toFixed(1) + "K"
    : Math.sign(num) * Math.abs(num)
}

//////////////////////////////
// Helper Functions (end)
/////////////////////////////
