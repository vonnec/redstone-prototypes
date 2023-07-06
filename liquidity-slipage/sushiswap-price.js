const ethers = require("ethers");
const dotenv = require("dotenv");
const redstone = require("redstone-api");

dotenv.config();

const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID;

const provider = new ethers.providers.JsonRpcProvider(
  `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`
);

const address = "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f"; // SushiSwap Router02 address

const abi = [
  "function getAmountsOut(uint256 amountIn, address[] memory path) public view returns (uint256[] memory amounts)",
];

const pairAbi = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
];

const contract = new ethers.Contract(address, abi, provider);

const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC address
const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH address

// Get the price of WETH in USDC from SushiSwap
async function getWethPriceInUSDC() {
  const factoryAddress = "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac"; // SushiSwap Factory address
  const factoryAbi = [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)",
  ];
  const factoryContract = new ethers.Contract(
    factoryAddress,
    factoryAbi,
    provider
  );

  const pairAddress = await factoryContract.getPair(usdcAddress, wethAddress);
  const pairContract = new ethers.Contract(pairAddress, pairAbi, provider);

  const reserves = await pairContract.getReserves();
  const wethReserve = reserves[1];
  const usdcReserve = reserves[0];

  const wethPriceInUSDC = usdcReserve
    .mul(ethers.utils.parseUnits("1", 18))
    .div(wethReserve);
  return wethPriceInUSDC;
}

// Checks how much WETH you will receive for a given USDC amount from SushiSwap
async function getWethAmount(usdcAmount) {
  const amounts = await contract.getAmountsOut(usdcAmount, [
    usdcAddress,
    wethAddress,
  ]);
  const wethAmount = ethers.utils.formatUnits(amounts[1].toString(), 18);
  return wethAmount;
}

async function calculateWethAmount() {
  const wethPriceInUSDC = await getWethPriceInUSDC();
  console.log(
    `Price WETH in USDC: ${ethers.utils.formatUnits(
      wethPriceInUSDC.toString(),
      6
    )}`
  );

  let usdcAmount = wethPriceInUSDC;
  let currentPrice = wethPriceInUSDC;
  const usdcPriceInUSD = await redstone.getPrice("USDC");

  let receivedWethAmount = 0;
  let expectedWethAmount = 0;
  while (receivedWethAmount * 2 >= expectedWethAmount) {
    receivedWethAmount = await getWethAmount(usdcAmount);
    expectedWethAmount = usdcAmount / currentPrice;

    const differencePercentage =
      ((receivedWethAmount - expectedWethAmount) / expectedWethAmount) * 100 +
      0.3; // 0.3 is gas fee
    const priceInUSD = (usdcPriceInUSD.value * usdcAmount) / 1e6;

    console.log(
      `For ${ethers.utils.formatUnits(
        usdcAmount.toString(),
        6
      )} USDC (${priceInUSD.toFixed(
        2
      )} USD), received WETH: ${receivedWethAmount}, expected WETH: ${expectedWethAmount}, difference: ${differencePercentage.toFixed(
        2
      )}%`
    );

    usdcAmount *= 2;
  }
}

calculateWethAmount().catch((err) => {
  console.error("Error occured:", err);
});
