import { PairHourData } from './../types/schema'
/* eslint-disable prefer-const */
import { BigInt, BigDecimal, EthereumEvent } from '@graphprotocol/graph-ts'
import { Pair, Bundle, Token, BSCswapHFactory, BSCswapDayData, PairDayData, TokenDayData } from '../types/schema'
import { ONE_BI, ZERO_BD, ZERO_BI, FACTORY_ADDRESS } from './helpers'

// max number of entities to store
const maxTokenDayDatas = 10
const maxPairDayDatas = 10

export function updateBSCswapDayData(event: EthereumEvent):BSCswapDayData {
  let bscswap = BSCswapHFactory.load(FACTORY_ADDRESS)
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let dayStartTimestamp = dayID * 86400
  let bscswapDayData = BSCswapDayData.load(dayID.toString())
  if (bscswapDayData === null) {
    let bscswapDayData = new BSCswapDayData(dayID.toString())
    bscswapDayData.date = dayStartTimestamp
    bscswapDayData.dailyVolumeUSD = ZERO_BD
    bscswapDayData.dailyVolumeHT = ZERO_BD
    bscswapDayData.totalVolumeUSD = ZERO_BD
    bscswapDayData.totalVolumeHT = ZERO_BD
    bscswapDayData.dailyVolumeUntracked = ZERO_BD
    bscswapDayData.totalLiquidityUSD = ZERO_BD
    bscswapDayData.totalLiquidityHT = ZERO_BD
    bscswapDayData.maxStored = maxTokenDayDatas
    bscswapDayData.mostLiquidTokens = bscswap.mostLiquidTokens
    bscswapDayData.txCount = ZERO_BI
    bscswapDayData.save()
  }
  bscswapDayData = BSCswapDayData.load(dayID.toString())
  bscswapDayData.totalLiquidityUSD = bscswap.totalLiquidityUSD
  bscswapDayData.totalLiquidityHT = bscswap.totalLiquidityHT
  bscswapDayData.txCount = bscswap.txCount
  bscswapDayData.save()
  return bscswapDayData as BSCswapDayData
}

export function updatePairDayData(event: EthereumEvent): PairDayData {
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let dayStartTimestamp = dayID * 86400
  let dayPairID = event.address
    .toHexString()
    .concat('-')
    .concat(BigInt.fromI32(dayID).toString())
  let pair = Pair.load(event.address.toHexString())
  let pairDayData = PairDayData.load(dayPairID)
  if (pairDayData === null) {
    pairDayData = new PairDayData(dayPairID)
    pairDayData.date = dayStartTimestamp
    pairDayData.token0 = pair.token0
    pairDayData.token1 = pair.token1
    pairDayData.pairAddress = event.address
    pairDayData.dailyVolumeToken0 = ZERO_BD
    pairDayData.dailyVolumeToken1 = ZERO_BD
    pairDayData.dailyVolumeUSD = ZERO_BD
    pairDayData.dailyTxns = ZERO_BI
  }

  pairDayData.totalSupply = pair.totalSupply
  pairDayData.reserve0 = pair.reserve0
  pairDayData.reserve1 = pair.reserve1
  pairDayData.reserveUSD = pair.reserveUSD
  pairDayData.dailyTxns = pairDayData.dailyTxns.plus(ONE_BI)
  pairDayData.save()

  return pairDayData as PairDayData
}

export function updatePairHourData(event: EthereumEvent): PairHourData {
  let timestamp = event.block.timestamp.toI32()
  let hourIndex = timestamp / 3600 // get unique hour within unix history
  let hourStartUnix = hourIndex * 3600 // want the rounded effect
  let hourPairID = event.address
    .toHexString()
    .concat('-')
    .concat(BigInt.fromI32(hourIndex).toString())
  let pair = Pair.load(event.address.toHexString())
  let pairHourData = PairHourData.load(hourPairID)
  if (pairHourData === null) {
    pairHourData = new PairHourData(hourPairID)
    pairHourData.hourStartUnix = hourStartUnix
    pairHourData.pair = event.address.toHexString()
    pairHourData.hourlyVolumeToken0 = ZERO_BD
    pairHourData.hourlyVolumeToken1 = ZERO_BD
    pairHourData.hourlyVolumeUSD = ZERO_BD
    pairHourData.hourlyTxns = ZERO_BI
  }

  pairHourData.reserve0 = pair.reserve0
  pairHourData.reserve1 = pair.reserve1
  pairHourData.reserveUSD = pair.reserveUSD
  pairHourData.hourlyTxns = pairHourData.hourlyTxns.plus(ONE_BI)
  pairHourData.save()

  return pairHourData as PairHourData
}

export function updateTokenDayData(token: Token, event: EthereumEvent): TokenDayData {
  let bundle = Bundle.load('1')
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let dayStartTimestamp = dayID * 86400
  let tokenDayID = token.id
    .toString()
    .concat('-')
    .concat(BigInt.fromI32(dayID).toString())

  let tokenDayData = TokenDayData.load(tokenDayID)
  if (tokenDayData === null) {
    tokenDayData = new TokenDayData(tokenDayID)
    tokenDayData.date = dayStartTimestamp
    tokenDayData.token = token.id
    tokenDayData.priceUSD = token.derivedHT.times(bundle.htPrice)
    tokenDayData.dailyVolumeToken = ZERO_BD
    tokenDayData.dailyVolumeHT = ZERO_BD
    tokenDayData.dailyVolumeUSD = ZERO_BD
    tokenDayData.dailyTxns = ZERO_BI
    tokenDayData.totalLiquidityUSD = ZERO_BD
    tokenDayData.maxStored = maxPairDayDatas
    tokenDayData.mostLiquidPairs = token.mostLiquidPairs
  }
  tokenDayData.priceUSD = token.derivedHT.times(bundle.htPrice)
  tokenDayData.totalLiquidityToken = token.totalLiquidity
  tokenDayData.totalLiquidityHT = token.totalLiquidity.times(token.derivedHT as BigDecimal)
  tokenDayData.totalLiquidityUSD = tokenDayData.totalLiquidityHT.times(bundle.htPrice)
  tokenDayData.dailyTxns = tokenDayData.dailyTxns.plus(ONE_BI)
  tokenDayData.save()

  /**
   * @todo test if this speeds up sync
   */
  // updateStoredTokens(tokenDayData as TokenDayData, dayID)
  // updateStoredPairs(tokenDayData as TokenDayData, dayPairID)

  return tokenDayData as TokenDayData
}
