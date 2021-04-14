require("dotenv").config()
const stripe = require("stripe")(process.env.STRIPE_API_KEY)
const { getUnixTime, endOfMonth, startOfMonth } = require("date-fns")

const Twitter = require("twitter")

// Remember January is 0
// Get total for current month
const startRangeTimestamp = getUnixTime(new Date(startOfMonth(new Date())))
const endRangeTimestamp = getUnixTime(new Date(endOfMonth(new Date())))

const EXPECTED_ENV_VARS = [
  "TWITTER_CONSUMER_KEY",
  "TWITTER_CONSUMER_SECRET",
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

async function removeMe() {
  const totalRevenueForMonth = await getStripeRevenue(
    startRangeTimestamp,
    endRangeTimestamp
  )

  // let's assume my goal is $5k
  // and there are 10 squares to fill
  const GOAL = 5000
  const numOfTenRounded = ((totalRevenueForMonth / GOAL) * 10).toPrecision(1)

  const mrrSquares = buildMRRIconsForTwitter(numOfTenRounded, GOAL)
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
    console.log(`LOG: Verifying environment variables...\n`)
    const ACTUAL_ENV_VARS = EXPECTED_ENV_VARS.map((envVar) =>
      getEnvironmentVariable(envVar)
    )

    if (EXPECTED_ENV_VARS.length === ACTUAL_ENV_VARS.length) {
      console.log(`\nLOG: Found all expected environment variables\n`)
    }

    // Use array destructuring to grab the environment variables
    const [
      TWITTER_CONSUMER_KEY,
      TWITTER_CONSUMER_SECRET,
      TWITTER_ACCESS_TOKEN_KEY,
      TWITTER_ACCESS_TOKEN_SECRET,
      STRIPE_API_KEY,
    ] = ACTUAL_ENV_VARS

    // Create the Twitter client
    const twitter = new Twitter({
      consumer_key: TWITTER_CONSUMER_KEY,
      consumer_secret: TWITTER_CONSUMER_SECRET,
      access_token_key: TWITTER_ACCESS_TOKEN_KEY,
      access_token_secret: TWITTER_ACCESS_TOKEN_SECRET,
    })

    await verifyTwitterCredentials(twitter)

    // Create the Stripe client
    const stripe = require("stripe")(STRIPE_API_KEY)

    await verifyStripeCredentials(stripe)
    // validate Stripe API
    // do the thing!
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

/**
 * Verifies your Twitter credentials
 * @param client The Twitter client
 * @returns {undefined}
 *
 * See this {@link https://dev.to/deta/how-i-used-deta-and-the-twitter-api-to-update-my-profile-name-with-my-follower-count-tom-scott-style-l1j| Twitter tutorial} for more information about working with the Twitter API
 */
async function verifyTwitterCredentials(client) {
  return await client.get("account/verify_credentials", (err, res) => {
    if (err) {
      console.error(err)
      throw new Error(`❌ ERROR: could not verify your Twitter credentials`)
    }
    if (res) {
      const followerCount = res.followers_count
      console.log(`✅ Verified your Twitter credentials using follower count.`)
      console.log(`#️⃣  Your current follower count is ${followerCount}`)
    }
  })
}

/**
 * Verifies your Stripe credentials
 * @param client The Stripe client
 * @returns {undefined}
 *
 * See this {@link https://stripe.com/docs/development/quickstart| Stripe tutorial} for more information
 */
async function verifyStripeCredentials(client) {
  return await stripe.paymentIntents.create(
    {
      amount: 1000,
      currency: "usd",
      payment_method_types: ["card"],
      receipt_email: "jenny.rosen@example.com",
    },
    (err, res) => {
      if (err) {
        console.error(err)
        throw new Error(`❌ ERROR: could not verify your Twitter credentials`)
      }
      if (res) {
        const { amount, currency } = res
        console.log(
          `✅ Verified your Stripe credentials by creating a PaymentIntent.`
        )
        console.log(
          `💰 A payment intent of ${amount} ${currency.toUpperCase()}`
        )
      }
    }
  )
}

const iconsTypes = {
  square: { green: "🟩", yellow: "🟨", gray: "⬜" },
  circle: { green: "🟢", yellow: "🟡", gray: "⚪" },
}

/**
 * @param {number} n - the progress towards goal out of 10
 * @param {string} icon - the progress Icon (square or circle)
 * @example there are ten squares total, and n is 5, then it should return
 * "MRR: 0 🟩🟩🟩🟩🟩🟨⬜⬜⬜⬜  5K" or "MRR: 0 🟢🟢🟢🟢🟢🟡⚪⚪⚪⚪  5K"
 */
function buildMRRIconsForTwitter(n, goal, icon = "square") {
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

//////////////////////////////
// Helper Functions (end)
/////////////////////////////
