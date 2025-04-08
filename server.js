const express = require("express");
const { Alchemy, Network } = require("alchemy-sdk");
const axios = require("axios");
const { ethers } = require("ethers"); // Import ethers.js
require("dotenv").config();

// Initialize Alchemy SDK
const config = {
  apiKey: process.env.ALCHEMY_API_KEY, // Your Alchemy API Key
  network: Network.BASE_MAINNET, // Ethereum Mainnet (can change to other networks)
};
const alchemy = new Alchemy(config);

// Initialize Express app
const app = express();
const port = 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Function to fetch token data from DexTools API
const getTokenDataFromDex = async (contractAddress) => {
  const dexUrl = `https://api.dexscreener.com/token/v1/base/${contractAddress}`;

  try {
    const response = await axios.get(dexUrl);
    return response.data[0]; // Assuming we're getting a list of tokens, use the first one
  } catch (error) {
    console.error("Error fetching token data from DexTools:", error);
    return null;
  }
};

// Function to format token balance using ethers.js
const formatBalance = (balance, decimals) => {
  const formattedBalance = ethers.formatUnits(balance, decimals);
  return parseFloat(formattedBalance).toFixed(2); // Return the balance formatted to 2 decimals
};

// API endpoint to get token balances for a given wallet address (in the URL)
app.get("/getTokenBalances/:address", async (req, res) => {
  const address = req.params.address; // Extract address from the URL

  // Check if the wallet address is provided
  if (!address) {
    return res.status(400).json({ error: "Wallet address is required" });
  }

  try {
    // Fetch token balances for the provided address
    const balances = await alchemy.core.getTokenBalances(address);

    // Filter out tokens with zero balance
    const nonZeroBalances = balances.tokenBalances.filter((token) => {
      return token.tokenBalance !== "0";
    });

    const result = {
      totalWalletBalance: 0,
      tokens: [],
    };

    // Loop through all tokens with non-zero balances
    for (let token of nonZeroBalances) {
      const contractAddress = token.contractAddress;
      let balance = token.tokenBalance;

      // Get token data from DexTools API
      const tokenData = await getTokenDataFromDex(contractAddress);

      if (tokenData) {
        // Format the balance using ethers.js
        balance = formatBalance(balance, tokenData.baseToken.decimals);

        // Calculate the total balance in USD
        const totalBalance = (
          parseFloat(balance) * parseFloat(tokenData.priceUsd)
        ).toFixed(2);

        // Update the result object
        result.totalWalletBalance += parseFloat(totalBalance);

        // Add token info to the result
        result.tokens.push({
          name: tokenData.baseToken.name,
          symbol: tokenData.baseToken.symbol,
          quantity: balance,
          price: tokenData.priceUsd,
          image: tokenData.info.imageUrl,
          totalBalance: totalBalance,
          contractAddress: contractAddress,
        });
      }
    }

    // Send the response
    res.json(result);
  } catch (error) {
    console.error("Error fetching token balances:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching token balances" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
