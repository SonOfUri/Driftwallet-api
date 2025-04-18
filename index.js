// index.js
const express = require("express");
const cors = require("cors");
const { Alchemy, Network } = require("alchemy-sdk");
const axios = require("axios");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Allow requests from specific origin (your React app)
app.use(cors({ origin: "*" }));

// ------------------------------
// Initialize Alchemy SDK
// ------------------------------
const config = {
  apiKey: process.env.ALCHEMY_API_KEY, // Your Alchemy API Key
  network: Network.BASE_MAINNET, // Base Mainnet
};
const alchemy = new Alchemy(config);

// DexScreener API Base URL
const dexscreenerBaseURL = "https://api.dexscreener.com/tokens/v1/base/";

// ------------------------------
// Utility Functions
// ------------------------------

// Function to format token balance
const formatBalance = (balance, decimals) => {
  // Ensure the balance is a valid value
  if (!balance || balance === "0" || balance === "0x0" || balance === "0x") {
    console.log("Warning: Invalid or zero balance provided.");
    return 0; // Return 0 if balance is invalid or empty
  }
  try {
    // Convert to BigInt and divide by decimals
    const formattedBalance = Number(BigInt(balance)) / 10 ** decimals;
    return formattedBalance;
  } catch (error) {
    console.error("Error formatting balance:", error);
    return 0;
  }
};

// // Function to fetch token price from DexScreener API
// const getTokenPrice = async (contractAddress) => {
//   try {
//     const response = await axios.get(`${dexscreenerBaseURL}${contractAddress}`);
//     if (response.data && response.data.length > 0) {
//       const tokenData = response.data[0];
//       return parseFloat(tokenData.priceUsd); // Return the price in USD as a float
//     }
//     return null;
//   } catch (error) {
//     console.error(`Error fetching price for token: ${contractAddress}`, error);
//     return null;
//   }
// };

// // Function to fetch token image from DexScreener API
// const getTokenImage = async (contractAddress) => {
//   try {
//     const response = await axios.get(`${dexscreenerBaseURL}${contractAddress}`);
//     if (response.data && response.data.length > 0) {
//       const tokenData = response.data[0];
//       // Return the image if available, otherwise null.
//       return tokenData.info && tokenData.info.imageUrl
//         ? tokenData.info.imageUrl
//         : null;
//     }
//     return null;
//   } catch (error) {
//     console.error(`Error fetching image for token: ${contractAddress}`, error);
//     return null;
//   }
// };
const axiosConfig = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/90.0.4430.93 Safari/537.36",
  },
};

const getTokenPrice = async (contractAddress) => {
  try {
    const response = await axios.get(
      `${dexscreenerBaseURL}${contractAddress}`,
      axiosConfig
    );
    console.log(`DexScreener response for ${contractAddress}:`, response.data);
    if (response.data && response.data.length > 0) {
      const tokenData = response.data[0];
      return parseFloat(tokenData.priceUsd);
    }
    return null;
  } catch (error) {
    console.error(`Error fetching price for token: ${contractAddress}`, error);
    return null;
  }
};

const getTokenImage = async (contractAddress) => {
  try {
    const response = await axios.get(
      `${dexscreenerBaseURL}${contractAddress}`,
      axiosConfig
    );
    if (response.data && response.data.length > 0) {
      const tokenData = response.data[0];
      return tokenData.info && tokenData.info.imageUrl
        ? tokenData.info.imageUrl
        : null;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching image for token: ${contractAddress}`, error);
    return null;
  }
};
// Function to get token balances, fetch prices and images, and return formatted data
const getFormattedTokenBalances = async (address) => {
  console.log(`Fetching token balances for wallet address: ${address}`);
  try {
    // Fetch token balances for the provided address
    const balances = await alchemy.core.getTokenBalances(address);
    console.log(
      `Fetched ${balances.tokenBalances.length} token balances for ${address}`
    );

    let totalWalletBalance = 0; // Total value of the wallet in USD
    const tokens = []; // List of token data

    // Fetch Ethereum (ETH) balance from Alchemy
    const ethBalanceHex = await alchemy.core.getBalance(address);
    console.log("ETH Balance Hex:", ethBalanceHex);
    const ethBalanceInWei = BigInt(ethBalanceHex);
    const formattedEthBalance = Number(ethBalanceInWei) / 10 ** 18; // Convert Wei to Ether

    // Get ETH price using WETH contract address (as per your logic)
    const ethPrice = await getTokenPrice(
      "0x4200000000000000000000000000000000000006"
    );
    const ethTotalBalanceInUSD = formattedEthBalance * ethPrice;

    // Set a unique image URL for ETH
    const ethImage =
      "https://dd.dexscreener.com/ds-data/tokens/base/0x4200000000000000000000000000000000000006.png?key=7d6327";

    // Add ETH details
    tokens.push({
      name: "ETHEREUM",
      symbol: "ETH",
      quantity: formattedEthBalance,
      price: ethPrice,
      image: ethImage,
      totalBalance: ethTotalBalanceInUSD,
      contractAddress: "0x4200000000000000000000000000000000000006",
    });
    totalWalletBalance += ethTotalBalanceInUSD;

    // Process every token balance (excluding zero or invalid ones)
    for (let token of balances.tokenBalances) {
      const contractAddress = token.contractAddress;
      let balance = token.tokenBalance;
      console.log(`Raw Balance for ${contractAddress}:`, balance);

      if (
        !balance ||
        balance === "0" ||
        balance === "0x0" ||
        balance === "0x"
      ) {
        console.log(`Skipping token with invalid balance: ${contractAddress}`);
        continue;
      }

      try {
        // Convert balance string to BigInt if necessary
        if (typeof balance === "string" || balance instanceof String) {
          balance = BigInt(balance);
        } else if (typeof balance !== "bigint") {
          console.error(`Invalid balance for token: ${contractAddress}`);
          continue;
        }

        // Fetch token metadata (to obtain decimals, name, symbol)
        const metadata = await alchemy.core.getTokenMetadata(contractAddress);

        if (metadata && metadata.decimals) {
          const formattedBalance = formatBalance(balance, metadata.decimals);
          const price = await getTokenPrice(contractAddress);
          if (!price) continue; // Skip if price not found

          const image = await getTokenImage(contractAddress);
          const totalBalanceInUSD = formattedBalance * price;
          totalWalletBalance += totalBalanceInUSD;

          tokens.push({
            name: metadata.name,
            symbol: metadata.symbol,
            quantity: formattedBalance,
            price: price,
            image: image !== undefined ? image : null,
            totalBalance: totalBalanceInUSD,
            contractAddress: contractAddress,
          });

          // Debug logs for token data
          console.log(`Token: ${metadata.name} (${metadata.symbol})`);
          console.log(`Contract Address: ${contractAddress}`);
          console.log(`Balance: ${formattedBalance}`);
          console.log(`Price (USD): ${price}`);
          console.log(`Total Balance in USD: ${totalBalanceInUSD}`);
          console.log("----------------------------------");
        } else {
          console.log(`No metadata found for token: ${contractAddress}`);
        }
      } catch (error) {
        console.error(`Error processing token ${contractAddress}:`, error);
      }
    }

    console.log(`Total Wallet Balance (USD): ${totalWalletBalance}`);
    return {
      totalWalletBalance,
      tokens,
    };
  } catch (error) {
    console.error("Error fetching token balances:", error);
    throw error;
  }
};

// ------------------------------
// API Endpoint
// ------------------------------

// GET endpoint to fetch wallet balances by address.
// You can request via: GET http://localhost:3000/wallet/0xYourWalletAddress
app.get("/wallet/:address", async (req, res) => {
  const { address } = req.params;
  try {
    const result = await getFormattedTokenBalances(address);
    res.json(result);
  } catch (error) {
    console.error("Error handling API request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Optionally, add a simple root endpoint or other endpoints as needed
app.get("/", (req, res) => {
  res.send("Node.js Token Balance API is running.");
});

// ------------------------------
// Start the Server
// ------------------------------
app.listen(port, () => {
  console.log(`API Server is listening on port ${port}`);
});
