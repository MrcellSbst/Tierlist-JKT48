// Wishlist price data for JKT48 events and merchandise
export const wishlistPrices = {
    // Event Categories
    events: {
        "Video Call": {
            price: 120000,
            description: "1-on-1 video call session with a member",
            unit: "session"
        },
        "Meet & Greet": {
            price: 50000,
            description: "Meet & Greet session",
            unit: "session"
        },
        "2-Shot Meet & Greet": {
            price: 180000,
            description: "2-shot photo session during Meet & Greet",
            unit: "session"
        },
        "Theater Show": {
            price: 200000,
            description: "Regular theater show ticket",
            unit: "ticket"
        },
        "2-Shot Roulettes": {
            price: 100000,
            description: "2-Shot Roulettes ticket",
            unit: "ticket"
        }
    },

    // Merchandise Categories
    merchandise: {
        "Photopack": {
            price: 80000,
            description: "Member photopack",
            unit: "pack"
        },
        "Lightstick": {
            price: 280000,
            description: "Official JKT48 lightstick",
            unit: "piece"
        },
        "Sticker": {
            price: 20000,
            description: "JKT48 sticker set",
            unit: "piece"
        },
        "Calendar": {
            price: 180000,
            description: "JKT48 calendar",
            unit: "piece"
        },
        "Key Chain": {
            price: 50000,
            description: "JKT48 key chain",
            unit: "piece"
        },
        "Uchiwa": {
            price: 30000,
            description: "Paper fan with member design",
            unit: "piece"
        },
        "Hand Banner": {
            price: 100000,
            description: "JKT48 hand banner",
            unit: "piece"
        }
    },

    // User-defined price merchandise
    userDefinedMerch: {
         "Membership/OFC": {
            price: 0,
            description: "Price for Membership/OFC",
            unit: "service",
            isUserDefined: true
        },

        "PhotoPrint": {
            price: 0,
            description: "Photo print merchandise",
            unit: "piece",
            isUserDefined: true
        },
        "T-Shirt": {
            price: 195000, // Default price
            description: "Official JKT48 t-shirt",
            unit: "piece",
            isUserDefined: true
        },
        "Lanyard": {
            price: 40000, // Default price
            description: "JKT48 neck strap/lanyard",
            unit: "piece",
            isUserDefined: true
        },
        "Music CD": {
            price: 80000, // Default price
            description: "JKT48 Music CD",
            unit: "piece",
            isUserDefined: true
        }
    },

    // Joki Categories (User-defined prices)
    joki: {
        "Joki": {
            price: 0,
            description: "Joki VC/MnG/2Shot",
            unit: "service",
            isUserDefined: true
        }
    }
};

// Function to get all categories (both events and merchandise)
export const getAllCategories = () => {
    const eventCategories = Object.keys(wishlistPrices.events).map(key => ({
        name: key,
        ...wishlistPrices.events[key],
        type: 'event'
    }));
    
    const merchCategories = Object.keys(wishlistPrices.merchandise).map(key => ({
        name: key,
        ...wishlistPrices.merchandise[key],
        type: 'merchandise'
    }));

    const userDefinedMerchCategories = Object.keys(wishlistPrices.userDefinedMerch).map(key => ({
        name: key,
        ...wishlistPrices.userDefinedMerch[key],
        type: 'merchandise'
    }));

    const jokiCategories = Object.keys(wishlistPrices.joki).map(key => ({
        name: key,
        ...wishlistPrices.joki[key],
        type: 'joki'
    }));
    
    return [...eventCategories, ...merchCategories, ...userDefinedMerchCategories, ...jokiCategories];
};

// Function to get price by category name
export const getPriceByCategory = (categoryName) => {
    const eventPrice = wishlistPrices.events[categoryName];
    if (eventPrice) return eventPrice;
    
    const merchPrice = wishlistPrices.merchandise[categoryName];
    if (merchPrice) return merchPrice;

    const userDefinedMerchPrice = wishlistPrices.userDefinedMerch[categoryName];
    if (userDefinedMerchPrice) return userDefinedMerchPrice;

    const jokiPrice = wishlistPrices.joki[categoryName];
    if (jokiPrice) return jokiPrice;
    
    return null;
};

// Function to check if a category exists
export const categoryExists = (categoryName) => {
    return categoryName in wishlistPrices.events || 
           categoryName in wishlistPrices.merchandise ||
           categoryName in wishlistPrices.userDefinedMerch ||
           categoryName in wishlistPrices.joki;
};

// Function to check if a category has user-defined pricing
export const isUserDefinedPrice = (categoryName) => {
    const jokiCategory = wishlistPrices.joki[categoryName];
    if (jokiCategory) return jokiCategory.isUserDefined;

    const userDefinedMerch = wishlistPrices.userDefinedMerch[categoryName];
    if (userDefinedMerch) return userDefinedMerch.isUserDefined;

    return false;
};
