const { expect } = require("chai");
const { ethers } = require("hardhat");
const { getnft721 } = require('../scripts/helper');
const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
// const { fromWei } = require('web3-utils');
// const { web3 } = require("@openzeppelin/test-helpers/src/setup");
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
describe("LFWAuction", function () {

    const tokenId = 0;
    const itemSalePrice = 100;
    const startPrice = 1000000;
    const stepPrice = 1000;
    let startBlock = 10;
    let endBlock = 20;
    let deployer = "";
    let minter = "";
    let buyer = "";
    let buyer2 = "";
    let buyer3 = "";
    let buyer4 = "";
    let treasuryAddress = "";

    before(async function () {
        this.LFWAuction = await ethers.getContractFactory("LFWAuction");
        const accounts = await ethers.getSigners();
        deployer = accounts[0];
        minter = accounts[1];
        buyer = accounts[2];
        treasuryAddress = accounts[3];
        buyer2 = accounts[4];
        buyer3 = accounts[5];
        buyer4 = accounts[6];
    });

    beforeEach(async function () {
        const instanceLFWAuction = await upgrades.deployProxy(this.LFWAuction);
        this.auctionHouse = await instanceLFWAuction.deployed();
        this.nft721 = await getnft721();

        await this.nft721.toogleOffering();

        await this.auctionHouse.whitelistContract(this.nft721.address);
        await this.auctionHouse.setTreasury(treasuryAddress.address);
    });

    it("Should initial right data", async function () {
        await this.auctionHouse.setTreasury(treasuryAddress.address);
        expect((await this.auctionHouse.treasury())).to.equal(treasuryAddress.address);
    });

    it("Should change owner after create auction", async function () {
        await ethers.provider.getBlockNumber().then((blockNumber) => {
            console.log("Current block number: " + blockNumber);
            startBlock = blockNumber + 5;
            endBlock = blockNumber + 30;
        });
        //mint new nft token
        await this.nft721.connect(minter).mintFirstOffering(tokenId);
        // approve for auctionHouse contract
        await this.nft721.connect(minter).approve(this.auctionHouse.address, tokenId);
        // create new listing
        await this.auctionHouse.connect(minter).createAuction(this.nft721.address, tokenId, startPrice, stepPrice, startBlock, endBlock, minter.address);

        expect(await this.nft721.ownerOf(tokenId)).to.equal(this.auctionHouse.address);
    });

    it("Should change owner after cancel listing item", async function () {
        //mint new nft token
        await ethers.provider.getBlockNumber().then((blockNumber) => {
            console.log("Current block number: " + blockNumber);
            startBlock = blockNumber + 5;
            endBlock = blockNumber + 300;
        });
        //mint new nft token
        await this.nft721.connect(minter).mintFirstOffering(tokenId);
        // approve for auctionHouse contract
        await this.nft721.connect(minter).approve(this.auctionHouse.address, tokenId);
        // create new listing
        await this.auctionHouse.connect(minter).createAuction(this.nft721.address, tokenId, startPrice, stepPrice, startBlock, endBlock, minter.address);

        await this.auctionHouse.connect(minter).cancelAuction(this.nft721.address, tokenId);

        expect(await this.nft721.ownerOf(tokenId)).to.equal(minter.address);
    });

    it("Should change price after update auction start price", async function () {
        const newPrice = 100 ** 3;
        //mint new nft token
        await ethers.provider.getBlockNumber().then((blockNumber) => {
            console.log("Current block number: " + blockNumber);
            startBlock = blockNumber + 5;
            endBlock = blockNumber + 30;
        });
        //mint new nft token
        await this.nft721.connect(minter).mintFirstOffering(tokenId);
        // approve for auctionHouse contract
        await this.nft721.connect(minter).approve(this.auctionHouse.address, tokenId);
        // create new listing
        await this.auctionHouse.connect(minter).createAuction(this.nft721.address, tokenId, startPrice, stepPrice, startBlock, endBlock, minter.address);

        await this.auctionHouse.connect(minter).updateAuctionStartPrice(this.nft721.address, tokenId, newPrice);

        expect((await this.auctionHouse.getAuction(this.nft721.address, tokenId))[0]).to.equal(newPrice);
    });

    it("Should revert transaction with wrong price", async function () {
        //mint new nft token
        await ethers.provider.getBlockNumber().then((blockNumber) => {
            console.log("Current block number: " + blockNumber);
            startBlock = blockNumber + 5;
            endBlock = blockNumber + 30;
        });
        //mint new nft token
        await this.nft721.connect(minter).mintFirstOffering(tokenId);
        // approve for auctionHouse contract
        await this.nft721.connect(minter).approve(this.auctionHouse.address, tokenId);
        // create new listing
        await this.auctionHouse.connect(minter).createAuction(this.nft721.address, tokenId, startPrice, stepPrice, startBlock, endBlock, minter.address);

        // set service fee 5%
        await this.auctionHouse.setServiceFee(5);

        // revert transaction buy if wrong price
        await expectRevert(
            this.auctionHouse.connect(buyer).bid(this.nft721.address, tokenId, { value: 1000 }),
            "reverted with reason string 'LFWAuction: Bid amount invalid'"
        );
    });

    it("Should emit an event Bid after bid success", async function () {
        //mint new nft token
        await ethers.provider.getBlockNumber().then((blockNumber) => {
            // console.log("Current block number: " + blockNumber);
            startBlock = blockNumber + 5;
            endBlock = blockNumber + 200;
        });
        //mint new nft token
        await this.nft721.connect(minter).mintFirstOffering(tokenId);
        // approve for auctionHouse contract
        await this.nft721.connect(minter).approve(this.auctionHouse.address, tokenId);
        // create new listing
        await this.auctionHouse.connect(minter).createAuction(this.nft721.address, tokenId, startPrice, stepPrice, startBlock, endBlock, minter.address);
        // set service fee 5%
        await this.auctionHouse.setServiceFee(5);

        let auctionStartBlock = startBlock;
        while (auctionStartBlock < startBlock + 1) {
            await this.auctionHouse.setServiceFee(5);
            await ethers.provider.getBlockNumber().then((blockNumber) => {
                console.log("Wait start auction Current block number: " + blockNumber);
                auctionStartBlock = blockNumber;
            });
            await sleep(100);
        }

        // make bid with correct price except successful transaction
        await this.auctionHouse.connect(buyer).bid(this.nft721.address, tokenId, { value: startPrice.toString() });
        const NewAuctionNFTBid = (await this.auctionHouse.queryFilter('NewAuctionNFTBid'))[0];
        expect(NewAuctionNFTBid.args[1]).to.equal(buyer.address);
    });

    it("Should revert next bid with wrong price", async function () {
        //mint new nft token
        await ethers.provider.getBlockNumber().then((blockNumber) => {
            console.log("Current block number: " + blockNumber);
            startBlock = blockNumber + 5;
            endBlock = blockNumber + 1000;
        });
        //mint new nft token
        await this.nft721.connect(minter).mintFirstOffering(tokenId);
        // approve for auctionHouse contract
        await this.nft721.connect(minter).approve(this.auctionHouse.address, tokenId);
        // create new listing
        await this.auctionHouse.connect(minter).createAuction(this.nft721.address, tokenId, startPrice, stepPrice, startBlock, endBlock, minter.address);

        // set service fee 5%
        await this.auctionHouse.setServiceFee(5);

        await this.auctionHouse.connect(buyer).bid(this.nft721.address, tokenId, { value: startPrice.toString() });

        // revert transaction buy if wrong price
        await expectRevert(
            this.auctionHouse.connect(buyer).bid(this.nft721.address, tokenId, { value: startPrice.toString() }),
            "reverted with reason string 'LFWAuction: Bid amount invalid'"
        );
    });

    it("Should revert next bid because auction ended", async function () {
        //mint new nft token
        await ethers.provider.getBlockNumber().then((blockNumber) => {
            console.log("Current block number: " + blockNumber);
            startBlock = blockNumber + 5;
            endBlock = blockNumber + 20;
        });
        //mint new nft token
        await this.nft721.connect(minter).mintFirstOffering(tokenId);
        // approve for auctionHouse contract
        await this.nft721.connect(minter).approve(this.auctionHouse.address, tokenId);
        // create new listing
        // set service fee 5%
        await this.auctionHouse.setServiceFee(5);

        await this.auctionHouse.connect(minter).createAuction(this.nft721.address, tokenId, startPrice, stepPrice, startBlock, endBlock, minter.address);

        await this.auctionHouse.connect(buyer).bid(this.nft721.address, tokenId, { value: startPrice.toString() });

        //mint new nft token
        let auctionEndBlock = startBlock;
        while (auctionEndBlock <= endBlock + 1) {
            await this.auctionHouse.setServiceFee(5);
            await ethers.provider.getBlockNumber().then((blockNumber) => {
                console.log("Wait end auction Current block number: " + blockNumber);
                auctionEndBlock = blockNumber;
            });
            await sleep(1000);
        }

        await expectRevert(
            this.auctionHouse.connect(buyer).bid(this.nft721.address, tokenId, { value: (startPrice + stepPrice).toString() }),
            "reverted with reason string 'LFWAuction: Auction ended'"
        );
    });

    it("Should claim bid after auction ended", async function () {
        //mint new nft token
        await this.nft721.connect(minter).mintFirstOffering(tokenId);
        // approve for auctionHouse contract
        await this.nft721.connect(minter).approve(this.auctionHouse.address, tokenId);
        // set service fee 5%
        await this.auctionHouse.setServiceFee(5);

        await ethers.provider.getBlockNumber().then((blockNumber) => {
            console.log("Current block number: " + blockNumber);
            startBlock = blockNumber + 2;
            endBlock = blockNumber + 8;
        });
        await this.auctionHouse.connect(minter).createAuction(this.nft721.address, tokenId, startPrice, stepPrice, startBlock, endBlock, minter.address);

        let auctionStartBlock = startBlock;
        while (auctionStartBlock < startBlock + 1) {
            await this.auctionHouse.setServiceFee(5);
            await ethers.provider.getBlockNumber().then((blockNumber) => {
                console.log("Wait start auction Current block number: " + blockNumber);
                auctionStartBlock = blockNumber;
            });
            await sleep(100);
        }
        await this.auctionHouse.connect(buyer).bid(this.nft721.address, tokenId, { value: startPrice.toString() });

        const NewAuctionNFTBid = (await this.auctionHouse.queryFilter('NewAuctionNFTBid'))[0];
        expect(NewAuctionNFTBid.args[1]).to.equal(buyer.address);

        //mint new nft token
        let auctionEndBlock = startBlock;
        while (auctionEndBlock < endBlock + 1) {
            await this.auctionHouse.setServiceFee(5);
            await ethers.provider.getBlockNumber().then((blockNumber) => {
                console.log("Wait end auction Current block number: " + blockNumber);
                auctionEndBlock = blockNumber;
            });
            await sleep(100);
        }
        console.log("this.auctionHouse.address=" + this.auctionHouse.address)
        console.log("minter.address=" + minter.address)
        console.log("buyer.address=" + buyer.address)

        await this.auctionHouse.connect(buyer).claimBid(this.nft721.address, tokenId)
        const AuctionNFTFinished = (await this.auctionHouse.queryFilter('AuctionNFTFinished'))[0];
        console.log("AuctionNFTFinisheds=" + JSON.stringify(AuctionNFTFinished));
        expect(AuctionNFTFinished.args[4]).to.equal(buyer.address);

        // expect(await this.nft721.ownerOf(tokenId)).to.equal(buyer.address);
    });

    it("Should refund NFT after auction ended but not have bid", async function () {
        //mint new nft token
        await this.nft721.connect(minter).mintFirstOffering(tokenId);
        // approve for auctionHouse contract
        await this.nft721.connect(minter).approve(this.auctionHouse.address, tokenId);
        // set service fee 5%
        await this.auctionHouse.setServiceFee(5);

        await ethers.provider.getBlockNumber().then((blockNumber) => {
            console.log("Current block number: " + blockNumber);
            startBlock = blockNumber + 2;
            endBlock = blockNumber + 8;
        });
        await this.auctionHouse.connect(minter).createAuction(this.nft721.address, tokenId, startPrice, stepPrice, startBlock, endBlock, minter.address);

        const NewAuctionNFTBid = (await this.auctionHouse.queryFilter('NewAuctionNFTBid'))[0];
        expect(NewAuctionNFTBid.args[1]).to.equal(buyer.address);

        //mint new nft token
        let auctionEndBlock = startBlock;
        while (auctionEndBlock < endBlock + 1) {
            await this.auctionHouse.setServiceFee(5);
            await ethers.provider.getBlockNumber().then((blockNumber) => {
                console.log("Wait end auction Current block number: " + blockNumber);
                auctionEndBlock = blockNumber;
            });
            await sleep(100);
        }
        await this.auctionHouse.connect(buyer).claimBid(this.nft721.address, tokenId)
        const AuctionNFTFinished = (await this.auctionHouse.queryFilter('AuctionNFTFinished'))[0];
        console.log("AuctionNFTFinisheds=" + JSON.stringify(AuctionNFTFinished));
        expect(AuctionNFTFinished.args[4]).to.equal(minter.address);

        // expect(await this.nft721.ownerOf(tokenId)).to.equal(buyer.address);
    });

    it("Should revert claim bid if auction is running", async function () {
        //mint new nft token

        //mint new nft token
        await this.nft721.connect(minter).mintFirstOffering(tokenId);
        // approve for auctionHouse contract
        await this.nft721.connect(minter).approve(this.auctionHouse.address, tokenId);
        // set service fee 5%
        await this.auctionHouse.setServiceFee(5);

        await ethers.provider.getBlockNumber().then((blockNumber) => {
            console.log("Current block number: " + blockNumber);
            startBlock = blockNumber + 2;
            endBlock = blockNumber + 8;
        });
        await this.auctionHouse.connect(minter).createAuction(this.nft721.address, tokenId, startPrice, stepPrice, startBlock, endBlock, minter.address);

        await this.auctionHouse.connect(buyer).bid(this.nft721.address, tokenId, { value: startPrice.toString() });

        await expectRevert(
            this.auctionHouse.connect(buyer).claimBid(this.nft721.address, tokenId),
            "reverted with reason string 'LFWAuction: Auction is running'"
        );
    });

    it("Should claim credit if bid kicked out", async function () {

        //mint new nft token
        await this.nft721.connect(minter).mintFirstOffering(tokenId);
        // approve for auctionHouse contract
        await this.nft721.connect(minter).approve(this.auctionHouse.address, tokenId);
        // set service fee 5%
        await this.auctionHouse.setServiceFee(5);

        await ethers.provider.getBlockNumber().then((blockNumber) => {
            console.log("Current block number: " + blockNumber);
            startBlock = blockNumber + 2;
            endBlock = blockNumber + 6;
        });

        await this.auctionHouse.connect(minter).createAuction(this.nft721.address, tokenId, startPrice, stepPrice, startBlock, endBlock, minter.address);

        await this.auctionHouse.connect(buyer).bid(this.nft721.address, tokenId, { value: startPrice.toString() });
        await this.auctionHouse.connect(buyer2).bid(this.nft721.address, tokenId, { value: (startPrice + stepPrice).toString() });
        await this.auctionHouse.connect(buyer3).bid(this.nft721.address, tokenId, { value: (startPrice + stepPrice * 2).toString() });

        //mint new nft token
        let auctionEndBlock = startBlock;
        while (auctionEndBlock < endBlock + 1) {
            await this.auctionHouse.setServiceFee(5);
            await ethers.provider.getBlockNumber().then((blockNumber) => {
                console.log("Wait end auction Current block number: " + blockNumber);
                auctionEndBlock = blockNumber;
            });
            await sleep(1000);
        }

        expect((await this.auctionHouse.connect(buyer).getPendingCredit())).to.equal(0);
        expect((await this.auctionHouse.connect(buyer2).getPendingCredit())).to.equal(0);

        this.auctionHouse.connect(buyer).withdrawAllFailedCredits();
        const NewAuctionNFTBid = (await this.auctionHouse.queryFilter('NewAuctionNFTBid'));
        // console.log("NewAuctionNFTBid " + JSON.stringify(NewAuctionNFTBid));
        expect(NewAuctionNFTBid[0].args[1]).to.equal(buyer.address);
        expect(NewAuctionNFTBid[1].args[1]).to.equal(buyer2.address);
    });

    it("Should update start and end block of auction", async function () {

        //mint new nft token
        await this.nft721.connect(minter).mintFirstOffering(tokenId);
        // approve for auctionHouse contract
        await this.nft721.connect(minter).approve(this.auctionHouse.address, tokenId);
        // set service fee 5%
        await this.auctionHouse.setServiceFee(5);

        await ethers.provider.getBlockNumber().then((blockNumber) => {
            console.log("Current block number: " + blockNumber);
            startBlock = blockNumber + 1;
            endBlock = blockNumber + 30;
        });

        await this.auctionHouse.connect(minter).createAuction(this.nft721.address, tokenId, startPrice, stepPrice, startBlock, endBlock, minter.address);

        await this.auctionHouse.connect(buyer).bid(this.nft721.address, tokenId, { value: startPrice.toString() });
        await this.auctionHouse.connect(buyer2).bid(this.nft721.address, tokenId, { value: (startPrice + stepPrice).toString() });
        await this.auctionHouse.connect(buyer3).bid(this.nft721.address, tokenId, { value: (startPrice + stepPrice * 2).toString() });

        //mint new nft token
        let auctionEndBlock = startBlock;
        while (auctionEndBlock < endBlock + 1) {
            await this.auctionHouse.setServiceFee(5);
            await ethers.provider.getBlockNumber().then((blockNumber) => {
                console.log("Wait end auction Current block number: " + blockNumber);
                auctionEndBlock = blockNumber;
            });
            await sleep(1000);
        }

        expect((await this.auctionHouse.connect(buyer).getPendingCredit())).to.equal(0);
        expect((await this.auctionHouse.connect(buyer2).getPendingCredit())).to.equal(0);

        this.auctionHouse.connect(buyer).withdrawAllFailedCredits();
        const NewAuctionNFTBid = (await this.auctionHouse.queryFilter('NewAuctionNFTBid'));
        // console.log("NewAuctionNFTBid " + JSON.stringify(NewAuctionNFTBid));
        expect(NewAuctionNFTBid[0].args[1]).to.equal(buyer.address);
        expect(NewAuctionNFTBid[1].args[1]).to.equal(buyer2.address);
    });


});
