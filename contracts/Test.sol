// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";

contract AppWorks is ERC721AUpgradeable, OwnableUpgradeable {
    using StringsUpgradeable for uint256;

    using Counters for Counters.Counter;
    Counters.Counter private nextTokenId;

    uint256 public price;
    uint256 public maxSupply;
    
    bool public mintActive;
    bool public earlyMintActive;
    bool public revealed;
    
    string public baseURI;
    bytes32 public merkleRoot;

    // 還未揭露盲盒前的default 圖
    string private _blindTokenURI;

    mapping(uint256 => string) private _tokenURIs;
    mapping(address => uint256) public addressMintedBalance;

    string public uriSuffix;

  

    function initialize() initializerERC721A initializer public {
        __ERC721A_init("HulkNFT", "Hulk");
        __Ownable_init();


        price = 0.01 ether;
        maxSupply = 100;

        mintActive = false;
        revealed = false;
        earlyMintActive = false;
        baseURI = "ipfs://QmepgF157YG2efD6wQ7vUcwHYqv3aty3cntaFp4JuNMaWF";
        merkleRoot = 0x9a1d98a5ffcc58f2d6dcaeeade93501909c779028aec29b92ce47965468f3d2b;
        
        _blindTokenURI = "ipfs://QmexqcLDvoP6HCTtSGumG3yzhZdH8guvV3z3kReCvf2QKn";
        uriSuffix = ".json";
        
    }
    
    
    function mint(uint256 _mintAmount) public payable {
        
        require(mintActive, "mint is not avilable");
        require(_checkMintLimit(msg.sender, _mintAmount + addressMintedBalance[msg.sender]), "mint amount is over limit");
        require(msg.value >= (price * _mintAmount), "insufficient fund");
        require(nextTokenId.current() + _mintAmount <= maxSupply, "mint over max supply");

        for(uint i = 0; i < _mintAmount; i++) {
            _mint(msg.sender, nextTokenId.current());
            nextTokenId.increment();
        }
        addressMintedBalance[msg.sender] += _mintAmount;

    }
    
    
    function totalSupply() public view virtual override returns(uint) {
        return nextTokenId.current();
    }

    
    function withdrawBalance() external onlyOwner {
        (bool sent, ) = msg.sender.call{value: address(this).balance}("");
        require(sent, "Failed to send Ether");
    }

    function setPrice(uint _price) external onlyOwner {
        price = _price;
    }
    
    function toggleMint() external onlyOwner {
        mintActive = !mintActive;
    }

    function _checkMintLimit(address _address, uint _amount) private view returns(bool) {
        uint limit = _address == owner() ? 20 : 10;
        return _amount <= limit;
    }

    function toggleReveal() public onlyOwner {
        revealed = !revealed;
    }

    //這邊要注意的是，設定baseURI後，要馬上設置 reveal 要不然，其實當baseURI 設定後，懂技術的人就知道盲盒長什麼樣了
    function setBaseURI(string memory _baseUR) public onlyOwner {
        baseURI = _baseUR;
    }
    

    // Function to return the base URI
    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }

    // Early mint function for people on the whitelist - week 9
    function earlyMint(bytes32[] calldata _merkleProof, uint256 _mintAmount) public payable {
        
        require(earlyMintActive, "Early Mint not start.");
        require(_checkMintLimit(msg.sender, _mintAmount + addressMintedBalance[msg.sender]), "mint amount is over limit");
        require(msg.value >= (price * _mintAmount) , "insufficient fund");
        require(nextTokenId.current() + _mintAmount <= maxSupply, "mint over max supply");
        
        bool result = checkValidity(_merkleProof);
        require(result,"You not in white list");

        for(uint i = 0; i < _mintAmount; i++) {
            _mint(msg.sender, nextTokenId.current());
            nextTokenId.increment();
        }
        addressMintedBalance[msg.sender] += _mintAmount;

    }
    //實作有無在白名單內
    function checkValidity(bytes32[] calldata _merkleProof) public view returns (bool){
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(MerkleProof.verify(_merkleProof, merkleRoot, leaf), "Incorrect proof");
        return true; // Or you can mint tokens here
    }


    //讓openSea去抓 NFT METADATA
    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );
        if (revealed) {
            return
                bytes(baseURI).length > 0
                    ? string(
                        abi.encodePacked(baseURI, tokenId.toString(), uriSuffix)
                    )
                    : "";
        } else {
            return _blindTokenURI;
        }
    }


    function toggleEarlyMint() public onlyOwner {
        earlyMintActive = !earlyMintActive;
    }
    
    function setMerkleRoot(bytes32 _newRoot) public onlyOwner {
        merkleRoot = _newRoot;
    } 

    // Let this contract can be upgradable, using openzepplin proxy library - week 10
    // Try to modify blind box images by using proxy
  
}