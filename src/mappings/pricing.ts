/* eslint-disable prefer-const */
import { Pair, Token, Bundle } from '../types/schema'
import { BigDecimal, Address, BigInt } from '@graphprotocol/graph-ts/index'
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD } from './helpers'

const WHT_ADDRESS = '0x5545153CCFcA01fbd7Dd11C0b23ba694D9509A6F'
const HUSD_WHT_PAIR = '0x6652CAc5e3B280d032032D9D350aE240ea5fd9C7' // created 10008355
const USDC_WHT_PAIR = '0x95Ea1f165b45847158017C6C9A6A4C9A9CC192ea' // created block 10042267
const USDT_WHT_PAIR = '0x73Fa6813a320502A626124448Af915810aC3f58d' // created block 10093341

// dummy for testing
export function getHtPriceInUSD(): BigDecimal {
  // fetch HT prices for each stablecoin
  let usdtPair = Pair.load(USDT_WHT_PAIR) // usdt is token0
  let husdPair = Pair.load(HUSD_WHT_PAIR) // husd is token1
  let usdcPair = Pair.load(USDC_WHT_PAIR) // usdc is token0

  // all 3 have been created
  if (usdcPair !== null && husdPair !== null && usdtPair !== null) {
    let totalLiquidityHT = usdcPair.reserve1.plus(husdPair.reserve0).plus(usdtPair.reserve1)
    let usdcWeight = usdcPair.reserve1.div(totalLiquidityHT)
    let husdWeight = husdPair.reserve0.div(totalLiquidityHT)
    let usdtWeight = usdtPair.reserve1.div(totalLiquidityHT)
    return usdcPair.token0Price
      .times(usdcWeight)
      .plus(husdPair.token1Price.times(husdWeight))
      .plus(usdtPair.token0Price.times(usdtWeight))
    // husd and usdt have been created
  } else if (husdPair !== null && usdtPair !== null) {
    let totalLiquidityHT = husdPair.reserve0.plus(usdtPair.reserve1)
    let husdWeight = husdPair.reserve0.div(totalLiquidityHT)
    let usdtWeight = usdtPair.reserve1.div(totalLiquidityHT)
    return husdPair.token1Price.times(husdWeight).plus(usdtPair.token0Price.times(usdtWeight))
    // usdt is the only pair so far
  } else if (usdtPair !== null) {
    return usdtPair.token0Price
  } else {
    return ZERO_BD
  }
}

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  '0x5545153CCFcA01fbd7Dd11C0b23ba694D9509A6F', // WHT
  '0x9362bbef4b8313a8aa9f0c9808b80577aa26b73b', // USDC
  '0x0298c2b32eae4da002a15f36fdf7615bea3da047', // HUSD
  '0xa71edc38d189767582c38a3145b5873052c3e47a', // USDT
]
// minimum liquidity required to count towards tracked volume for pairs with small # of Lps
let MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal.fromString('400000')

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_HT = BigDecimal.fromString('2')
/**
 * Search through graph to find derived HT per token.
 * @todo update to be derived HT (add stablecoin estimates)
 **/
export function findHtPerToken(token: Token): BigDecimal {
  if (token.id == WHT_ADDRESS) {
    return ONE_BD
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]))
    if (pairAddress.toHexString() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHexString())
      if (pair.token0 == token.id && pair.reserveHT.gt(MINIMUM_LIQUIDITY_THRESHOLD_HT)) {
        let token1 = Token.load(pair.token1)
        return pair.token1Price.times(token1.derivedHT as BigDecimal) // return token1 per our token * HT per token 1
      }
      if (pair.token1 == token.id && pair.reserveHT.gt(MINIMUM_LIQUIDITY_THRESHOLD_HT)) {
        let token0 = Token.load(pair.token0)
        return pair.token0Price.times(token0.derivedHT as BigDecimal) // return token0 per our token * HT per token 0
      }
    }
  }
  return ZERO_BD // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  pair: Pair
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedHT.times(bundle.htPrice)
  let price1 = token1.derivedHT.times(bundle.htPrice)

  // if less than 5 LPs, require high minimum reserve amount amount or return 0
  if (pair.liquidityProviderCount.lt(BigInt.fromI32(5))) {
    let reserve0USD = pair.reserve0.times(price0)
    let reserve1USD = pair.reserve1.times(price1)
    if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve0USD.plus(reserve1USD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
    if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
      if (reserve0USD.times(BigDecimal.fromString('2')).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
    if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve1USD.times(BigDecimal.fromString('2')).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
  }

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0
      .times(price0)
      .plus(tokenAmount1.times(price1))
      .div(BigDecimal.fromString('2'))
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0)
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1)
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedHT.times(bundle.htPrice)
  let price1 = token1.derivedHT.times(bundle.htPrice)

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1))
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString('2'))
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString('2'))
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}
