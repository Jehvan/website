const quizData = {
        start: {
            question: "Would you like a coffee, a non-alcoholic or an alcoholic beverage?",
            answers: {
                "Coffee": "coffeeQ1",
                "Non-Alcoholic": "nonAlcoholicQ1",
                "Alcoholic": "alcoholicQ1"
            }
        },
        // Coffee Path
        coffeeQ1: {
            question: "Do you prefer your coffee hot or cold?",
            answers: {
                "Hot": "coffeeHotQ2",
                "Cold": "coffeeColdQ2"
            }
        },
        coffeeHotQ2: {
            question: "How do you like your hot coffee?",
            answers: {
                "Espresso": "endEspresso",
                "Americano": "endAmericano",
                "Macchiato": "endMacchiato",
                "Small Macchiato": "endSmallMacchiato",
                "Cappuccino": "endCappuccino",
                "Latte": "endLatte",
                "Nescafe": "endNescafe"
            }
        },
        coffeeColdQ2: {
            question: "How do you like your cold coffee?",
            answers: {
                "Freddo Espresso": "endFreddoEspresso",
                "Freddo Cappuccino": "endFreddoCappuccino",
                "Iced Latte": "endIcedLatte",
                "Affogato": "endAffogato",
                "Nescafe": "endNescafe"
            }
        },

        // Non-Alcoholic Path
        nonAlcoholicQ1: {
            question: "Do you prefer something hot or cold?",
            answers: {
                "Hot": "nonAlcoholicHotQ2",
                "Cold": "nonAlcoholicColdQ2"
            }
        },
        nonAlcoholicHotQ2: {
            question: "Which hot beverage do you prefer?",
            answers: {
                "Tea": "endTea",
                "Salep": "endSalep",
                "Hot Cocoa": "endHotCocoa",
            }
        },
        nonAlcoholicColdQ2: {
            question: "Would you like a carbonated drink, a non-carbonated drink or a fresh juice?",
            answers: {
                "Carbonated": "nonAlcoholicColdCarbonatedQ3",
                "Non-Carbonated": "nonAlcoholicColdNonCarbonatedQ3",
                "Fresh Juice": "nonAlcoholicColdFreshJuiceQ3",
            }
        },
        nonAlcoholicColdCarbonatedQ3: {
            question: "Here are all our options for carbonated drinks:",
            answers: {
                "Coca-Cola": "endCocaCola",
                "Fanta": "endFanta",
                "Sprite": "endSprite",
                "Schweppes": "endSchweppes"
            }
        },

        nonAlcoholicColdNonCarbonatedQ3: {
            question: "Here are all our options for non-carbonated drinks:",
            answers: {
                "Fuze Tea": "endFuzeTea",
                "Next Juice": "endNextjuice",
                "San Pellegrino": "endSanPellegrino",
                "Monin": "endMonin",
                "Cedevita": "endCedevita",
            }
        },

        nonAlcoholicColdFreshJuiceQ3: {
            question: "Here are our options for a fresh juice:",
            answers: {
                "Orange juice": "endOrangeJuice",
                "Lemonade": "endLemonade",
                "Pomegranate Juice": "endPomegranate",
                "Mixed Juice": "endMixedJuice",
                "Seasonal Mixed Juice": "endSeasonMixedJuice",
            }
        },
        // Alcoholic Path
        alcoholicQ1: {
            question: "Do you prefer pure alcohol or a cocktail?",
            answers: {
                "Pure": "alcoholicPureQ2",
                "Cocktail": "alcoholicCocktailQ2"
            }
        },
        alcoholicPureQ2: {
            question: "Would you like beer, wine or liquor?",
            answers: {
                "Beer": "alcoholicPureBeerQ3",
                "Wine": "alcoholicPureWineQ3",
                "Liquor": "alcoholicPureLiquorQ3"
            }
        },
        alcoholicPureBeerQ3: {
            question: "Do you prefer draft beer?",
            answers: {
                "Yes": "alcoholicPureBeerDraftQ4",
                "No": "alcoholicPureBeerBottleQ4",
            }
        },
        alcoholicPureBeerDraftQ4: {
            question: "Do you prefer Skopsko, Skopsko Smooth or Heineken",
            answers: {
                "Skopsko": "endDraftSkopsko",
                "Skopsko Smooth": "endDraftSkopskoSmooth",
                "Heineken": "endDraftHeineken"
            }
        },
        alcoholicPureBeerBottleQ4: {
            question: "Which of these beers do you prefer?",
            answers: {
                "Skopsko": "endSkopsko",
                "Skopsko Smooth": "endSkopskoSmooth",
                "Skopsko Radler": "endSkopskoRadler",
                "Heineken": "endHeineken",
                "Corona": "endCorona",
                "Amstel": "endAmstel",
                "Mythos": "endMythos",
                "Bavaria": "endBavaria"
            }
        },
        alcoholicPureWineQ3: {
            question: "Do you prefer red or white wine?",
            answers: {
                "Red": "endTgaZaJug",
                "White": "alcoholicPureWineWhiteQ4"
            }
        },
        alcoholicPureWineWhiteQ4: {
            question: "Which of these white wines do you prefer?",
            answers: {
                "Aleksandrija": "endAleksandrija",
                "Traminec": "endTraminec",
                "Temjanika": "endTemjanika"
            }
        },
        alcoholicPureLiquorQ3: {
            question: "Which type of liquor do you prefer?",
            answers: {
                "Whiskey": "alcoholicPureLiquorWhiskeyQ4",
                "Gin": "alcoholicPureLiquorGinQ4",
                "Tequila": "endTequila",
                "Vodka": "alcoholicPureLiquorVodkaQ4",
                "Martini": "alcoholicPureLiquorMartiniQ4",
                "Rum": "alcoholicPureLiquorRumQ4"
            }
        },
        alcoholicPureLiquorWhiskeyQ4: {
            question: "These are our whiskey options",
            answers: {
                "Jameson": "endJameson",
                "Jameson Black": "endJamesonBlack",
                "Southern Comfort": "endSouthernComfort",
                "Jack Daniels": "endJackDaniels",
                "Gentleman Jack": "endGentlemanJack",
                "Single Barrel Jack Daniels": "endSingleBarrelJack",
                "Johnnie Walker Black Label": "endJohnnieWalkerBlackLabel",
                "Johnnie Walker Red Label": "endJohnnieWalkerRedLabel",
                "Jim Beam": "endJimBeam",
                "Chivas": "endChivas",
                "Macallan": "endMacallan",
            }
        },
        alcoholicPureLiquorGinQ4: {
            question: "Which of these Gins do you prefer?",
            answers: {
                "Gordon's": "endGordons",
                "Gordon's Pink": "endGordonsPink",
                "Bombay": "endBombay",
                "Tanqueray": "endTanqueray",
                "Tanqueray Royale": "endTanquerayRoyale",
            }
        },
        alcoholicPureLiquorVodkaQ4: {
            question: "Which of these vodkas do you prefer?",
            answers: {
                "Smirnoff": "endSmirnoff",
                "Absolut": "endAbsolut",
                "Absolut Citron": "endAbsolutCitron",
                "Grey Goose": "endGreyGoose",
            }
        },
        alcoholicPureLiquorMartiniQ4: {
            question: "Which type of martini do you prefer?",
            answers: {
                "Martini Rosso": "endMartiniRosso",
                "Martini Bianco": "endMartiniBianco"
            }
        },
        alcoholicPureLiquorRumQ4: {
            question: "Which of these rums do you prefer?",
            answers: {
                "White Rum": "endWhiteRum",
                "Dark Rum": "endDarkRum",
                "Spiced Gold Rum": "endSpicedGoldRum",
            }
        },

        alcoholicCocktailQ2: {
            question: "Do you prefer a refreshing, sweet, sour  or bitter cocktail?",
            answers: {
                "Refreshing": "alcoholicCocktailRefreshingQ3",
                "Sweet": "alcoholicCocktailSweetQ3",
                "Sour": "alcoholicCocktailSourQ3",
                "Bitter": "alcoholicCocktailBitterQ3"
            },
        },
        alcoholicCocktailRefreshingQ3: {
            question: "Which type of alcohol do you prefer",
            answers: {
                "Gin": "alcoholiccocktailRefreshingGinQ4",
                "Tequila": "alcoholiccocktailRefreshingTequilaQ4",
                "Vodka": "alcoholiccocktailRefreshingVodkaQ4",
                "Rum": "alcoholiccocktailRefreshingRumQ4",
                "Aperol": "alcoholiccocktailRefreshingAperolQ4",
            }
        },
        alcoholiccocktailRefreshingGinQ4: {
            question: "Do you like basil?",
            answers: {
                "Yes": "endBasilicZest",
                "No": "endTomCollins",
            }
        },
        alcoholiccocktailRefreshingTequilaQ4: {
            question: "Do you prefer grapefruit, green apple or cucumber?",
            answers: {
                "Green apple": "endZionSour",
                "Grapefruit": "endPaloma",
                "Cucumber": "endElCucumbre"
            }
        },
        alcoholiccocktailRefreshingVodkaQ4:{
            question: "Do you like bubblegum?",
            answers: {
                "Yes": "endBubbleBreeze",
                "No": "endCaipiroska",
            }
        },
        alcoholiccocktailRefreshingRumQ4: {
            question: "Do you like mint?",
            answers: {
                "Yes": "alcoholiccocktailRefreshingYesQ5",
                "No": "endCaipirinja",
            }
        },
        alcoholiccocktailRefreshingYesQ5: {
            question: "Do you like strawberry?",
            answers: {
                "Yes": "endMojitoStrawberry",
                "No": "endMojito",
            }
        },

        alcoholicCocktailSweetQ3: {
            question: "Which type of alcohol do you prefer?",
            answers: {
                "Whiskey": "endRosalia",
                "Gin": "alcoholicCocktailSweetGinQ4",
                "Tequila": "alcoholicCocktailSweetTequilaQ4",
                "Vodka": "alcoholicCocktailSweetVodkaQ4",
            }
        },
        alcoholicCocktailSweetGinQ4: {
            question: "Do you like peach or blueberry?",
            answers: {
                "Peach": "endTropicalTango",
                "Blueberry": "endBramble",
            }
        },
        alcoholicCocktailSweetTequilaQ4: {
            question: "Do you prefer grenadine or passionfruit?",
            answers: {
                "Grenadines": "endTequilaSunrise",
                "Passionfruit": "endPassionfruitMargarita"
            }
        },
        alcoholicCocktailSweetVodkaQ4: {
            question: "Do you like vanilla or peach?",
            answers: {
                "Vanilla": "endPornstarMartini",
                "Peach": "endPeachMajchin",
            }
        },

        alcoholicCocktailSourQ3: {
            question: "Which type of alcohol do you prefer?",
            answers: {
                "Whiskey": "endWhiskeySour",
                "Gin": "endGinSour",
                "Tequila": "alcoholicCocktailSourTequilaQ4",
                "Vodka": "alcoholicCocktailSourVodkaQ4",
                "Rum": "endJungleBird"
            }
        },
        alcoholicCocktailSourTequilaQ4: {
            question: "Do you prefer passionfruit, triple sec or neither?",
            answers: {
                "Passionfruit": "endCincoDeMayo",
                "Triple Sec": "endMargarita",
                "Neither": "endZionSour"
            }
        },
        alcoholicCocktailSourVodkaQ4: {
            question: "Do you prefer cranberry, green apple or neither ?",
            answers: {
                "Cranberry": "endCosmopolitan",
                "Green apple": "endMojoJojo",
                "Neither": "endVodkaSour"
            }
        },

        alcoholicCocktailBitterQ3: {
            question: "Do you prefer rum or gin?",
            answers: {
                "Rum": "endJungleBird",
                "Gin": "endNegroni",
            }
        },

        //Coffee Endings
        endEspresso: {
            question: "Your perfect drink is an Espresso! </br>" +
                "<img class='quiz-images' src='Images/espresso_img.jpg' alt='espresso' width='50%' height='auto' style='border-radius: 50%; border: solid #96BC33 3px; margin-top: 20%'/>"
        },
        endAmericano: {
            question: "Your perfect drink is an Americano! </br>" +
                "<img  class='quiz-images' src='Images/americano.jpg' alt='americano'/>"
        },
        endMacchiato: {
            question: "Your perfect drink is a Macchiato! </br> " +
                "<img  class='quiz-images' src='Images/macchiato_img.jpg' alt='macchiato'/>",
        },
        endSmallMacchiato: {
            question: "Your perfect drink is a small Macchiato! </br> " +
                "<img  class='quiz-images' src='Images/small_macchiato_img.jpg' alt='small macchiato'/>",
        },
        endLatte: {
            question: "Your perfect drink is a Latte! </br>" +
                "<img  class='quiz-images'  src=Images/latte.jpg alt='latte'>"
        },
        endNescafe: {
            question: "Your perfect drink is a Nescafe!</br>" +
                "<img  class='quiz-images'  src=Images/nescafe.jpg alt='nescafe'>"
        },
        endCappuccino: {
            question: "Your perfect drink is a Cappuccino! </br>" +
                "<img  class='quiz-images' src='Images/cappucino.jpg' alt='cappuccino'>"
        },
        endFreddoEspresso: {
            question: "Your perfect drink is a Freddo Espresso! </br>" +
                "<img  class='quiz-images' src='Images/freddo_espresso.jpg' alt='freddo'>"
        },
        endFreddoCappuccino: {
            question: "Your perfect drink is a Freddo Cappuccino! </br>" +
                "<img  class='quiz-images'  src='Images/freddo_espresso.jpg' alt='freddo_cappuccino'"
        },
        endIcedLatte: {
            question: "Your perfect drink is an Iced Latte! </br>" +
                "<img  class='quiz-images'  src='Images/iced_latte.jpg' alt='iced_latte'>"
        },
        endAffogato: {
            question: "Your perfect drink is an Affogato! </br>" +
                "<img  class='quiz-images' src='Images/affogato.jpg' alt='affogato'"
        },
        endTea: {
            question: "Your perfect drink is Tea with Rum(optional)! </br> " +
                "<img  class='quiz-images' src='Images/tea.jpg' alt='tea'/>"
        },
        endSalep: {
            question: "Your perfect drink is Salep! </br>" +
                "<img  class='quiz-images' src='Images/salep.jpg' alt='salep'/>"
        },
        endHotCocoa: {
            question: "Your perfect drink is Hot Cocoa! </br>" +
                "<img  class='quiz-images' src='Images/hot_cocoa.jpg' alt='hot_cocoa'/>"
        },
        //Juices endings
        endCocaCola: {
            question: "Your perfect drink is Coca Cola or Coca Cola Zero! </br>" +
                "<img  class='quiz-images' src='Images/coca_cola.jpg' alt='coca_cola'/>"
        },
        endFanta: {
            question: "Your perfect drink is Fanta! </br>" +
                "<img  class='quiz-images' src='Images/fanta.jpg' alt='fanta'/>"
        },
        endSprite: {
            question: "Your perfect drink is Sprite! </br>" +
                "<img  class='quiz-images' src='Images/sprite.jpg' alt='sprite'/>"
        },
        endSchweppes: {
            question: "Your perfect drink is Schweppes Bitterlemon, Tonic, Pink or Tangerine! </br>" +
                "<img  class='quiz-images' src='Images/schweppes.jpg' alt='schweppes'/>"
        },
        endFuzeTea: {
            question: "Your perfect drink is Fuze Tea peach! </br>" +
                "<img  class='quiz-images' src='Images/fuze.jpg' alt='fuze'/>"
        },
        endNextjuice: {
            question: "Your perfect drink is a Next Juice from apple, peach, orange or berry mix! </br>" +
                "<img  class='quiz-images' src='Images/nextjuice.jpg' alt='nextjuice'/>"
        },
        endSanPellegrino: {
            question: "Your perfect drink is San Pellegrino from orange, pomegranate or red orange! </br>" +
                "<img  class='quiz-images' src='Images/SanPellegrino.jpg' alt='SanPellegrino'/>"
        },
        endMonin: {
            question: "Your perfect drink is a Monin, ask the bartender what type of flavour is available! </br>" +
                "<img  class='quiz-images' src='Images/monin.png' alt='Monin'/>"
        },
        endCedevita: {
            question: "Your perfect drink is Cedevita orange, lemon, lime, mango or elderberry! </br>" +
                "<img  class='quiz-images' src='Images/cedevita.png' alt='cedevita'/>"
        },
        //Fresh juices endings
        endOrangeJuice: {
            question: "Your perfect drink is Orange Juice! </br>" +
                "<img  class='quiz-images' src='Images/orangeJuice.jpg' alt='orange''/>"
        },
        endLemonade: {
            question: "Your perfect drink is a Lemonade! </br>" +
                "<img  class='quiz-images' src='Images/lemonade.jpg' alt='lemonade'/>"
        },
        endPomegranate: {
            question: "Your perfect drink is Pomegranate juice! </br>" +
                "<img  class='quiz-images' src='Images/pomegranateJuice.jpg' alt='pomegranate juice' />"
        },
        endMixedJuice: {
            question: "Your perfect drink is a mixed juice (orange and lemon)! </br>" +
                "<img  class='quiz-images' src='Images/mixedJuice.jpg' alt='mixedJuice' />"
        },
        endSeasonMixedJuice: {
            question: "Your perfect drink is seasonal mixed juice(orange and pomegranate)! </br>" +
                "<img  class='quiz-images' src='Images/SeasonalMixedJuice.jpg' alt='seasonal mixed juice' />"
        },
        //Draft beers endings
        endDraftSkopsko: {
            question: "Your perfect drink is a draft Skopsko 0.5L! </br>" +
                "<img  class='quiz-images' src='Images/skopsko_draft.jpg' alt='beer'/>"
        },
        endDraftSkopskoSmooth: {
            question: "Your perfect drink is a draft Skopsko Smooth 0.5L! </br>" +
                "<img  class='quiz-images' src='Images/skopsko_draft.jpg' alt='beer'/>"
        },
        endDraftHeineken: {
            question: "Your perfect drink is a draft Heineken 0.5L! </br>" +
                "<img  class='quiz-images' src='Images/heineken_draft.jpg' alt='beer'/>"
        },
        //Bottled beers endings
        endSkopsko: {
            question: "Your perfect drink is a Skopsko 0.3L! </br>" +
                "<img  class='quiz-images' src='Images/heineken_draft.jpg' alt='beer'/>"
        },
        endSkopskoSmooth: {
            question: "Your perfect drink is a Skopsko Smooth 0.3L! </br>" +
                "<img  class='quiz-images' src='Images/heineken_draft.jpg' alt='beer'/>"
        },
        endSkopskoRadler: {
            question: "Your perfect drink is a Skopsko Radler 0.3L! </br>" +
                "<img  class='quiz-images' src='Images/radler.jpg' alt='beer'/>"
        },
        endHeineken: {
            question: "Your perfect drink is a Heineken 0.25L! </br>" +
                "<img  class='quiz-images' src='Images/heineken.png' alt='beer'/>"
        },
        endCorona: {
            question: "Your perfect drink is a Corona 0.3L! </br>" +
                "<img  class='quiz-images' src='Images/corona.jpg' alt='beer'/>"
        },
        endAmstel: {
            question: "Your perfect drink is an Amstel 0.3L! </br>" +
                "<img  class='quiz-images' src='Images/amstel.png' alt='beer'/>"
        },
        endMythos: {
            question: "Your perfect drink is a Mythos 0.3L! </br>" +
                "<img  class='quiz-images' src='Images/mythos.jpg' alt='beer'/>"
        },
        endBavaria: {
            question: "Your perfect drink is a Bavaria 0.3L </br>" +
                "<img  class='quiz-images' src='Images/bavaria.jpg' alt='beer'/>"
        },
        //Wine endings
        endTgaZaJug: {
            question: "Your perfect drink is a Tga Za Jug! </br>" +
                "<img  class='quiz-images' src='Images/tga.jpg' alt='wine'/>"
        },
        endAleksandrija: {
            question: "Your perfect drink is an Aleksandrija! </br>" +
                "<img  class='quiz-images' src='Images/aleksandrija.jpg' alt='wine'/>"
        },
        endTraminec: {
            question: "Your perfect drink is a Traminec! </br>" +
                "<img  class='quiz-images' src='Images/traminec.jpg' alt='wine'/>"
        },
        endTemjanika: {
            question: "Your perfect drink is a Temjanika! </br>" +
                "<img  class='quiz-images' src='Images/temjanika.png' alt='wine'/>"
        },
        //Whiskey endings
        endJameson: {
            question: "Your perfect drink is a Jameson whiskey! </br>" +
                "<img  class='quiz-images' src='Images/jameson.jpg' alt='whiskey'/>"
        },
        endJamesonBlack: {
            question: "Your perfect drink is a Jameson Black whiskey! </br>" +
                "<img  class='quiz-images' src='Images/jamesonblack.jpg' alt='whiskey'/>"
        },
        endSouthernComfort: {
            question: "Your perfect drink is a Southern Comfort whiskey! </br>" +
                "<img  class='quiz-images' src='Images/southern.jpg' alt='whiskey'/>"
        },
        endJackDaniels: {
            question: "Your perfect drink is a Jack Daniel's whiskey! </br>" +
                "<img  class='quiz-images' src='Images/jack.jpg' alt='whiskey'/>"
        },
        endGentlemanJack: {
            question: "Your perfect drink is a Gentleman Jack whiskey! </br>" +
                "<img  class='quiz-images' src='Images/gentlemanjack.jpg' alt='whiskey'/>"
        },
        endSingleBarrelJack: {
            question: "Your perfect drink is a Single Barrel Jack whiskey! </br>" +
                "<img  class='quiz-images' src='Images/jacksinglebarrel.jpg' alt='whiskey'/>"
        },
        endJohnnieWalkerBlackLabel: {
            question: "Your perfect drink is a Johnnie Walker Black Label whiskey! </br>" +
                "<img  class='quiz-images' src='Images/johnniered.jpg' alt='whiskey'/>"
        },
        endJohnnieWalkerRedLabel: {
            question: "Your perfect drink is a Johhnie Walker Red Label whiskey! </br>" +
                "<img  class='quiz-images' src='Images/johnnieblack.jpg' alt='whiskey'/>"
        },
        endJimBeam: {
            question: "Your perfect drink is a Jim Beam whiskey! </br>" +
                "<img  class='quiz-images' src='Images/jimbeam.jpg' alt='whiskey'/>"
        },
        endChivas: {
            question: "Your perfect drink is a Chivas whiskey! </br>" +
                "<img  class='quiz-images' src='Images/chivas.png' alt='whiskey'/>"
        },
        endMacallan: {
            question: "Your perfect drink is a Macallan whiskey! </br>" +
                "<img  class='quiz-images' src='Images/macallan.jpg' alt='whiskey'/>"
        },
        //Gin endings
        endGordons: {
            question: "Your perfect drink is Gordon's gin! </br>" +
                "<img  class='quiz-images' src='Images/gordons.jpg' alt='gin'/>"
        },
        endGordonsPink: {
            question: "Your perfect drink is a Gordon's Pink gin! </br>" +
                "<img  class='quiz-images' src='Images/pinkgordons.png' alt='gin'/>"
        },
        endBombay: {
            question: "Your perfect drink is a Bombay gin! </br>" +
                "<img  class='quiz-images' src='Images/bombay.jpg' alt='gin'/>"
        },
        endTanqueray: {
            question: "Your perfect drink is a Tanqueray gin! </br>" +
                "<img  class='quiz-images' src='Images/tanqueray.jpg' alt='gin'/>"
        },
        endTanquerayRoyale: {
            question: "Your perfect drink is a Tanqueray Royale gin! </br>" +
                "<img  class='quiz-images' src='Images/tanq-royale.jpg' alt='gin'/>"
        },
        endTequila: {
            question: "You get a shot of tequila! </br>" +
                "<img  class='quiz-images' src='Images/tequila.jpg' alt='tequila'/>"
        },
        //Vodka endings
        endSmirnoff: {
            question: "Your perfect drink is a Smirnoff vodka! </br>" +
                "<img  class='quiz-images' src='Images/smirnoff.jpg' alt='vodka'/>"
        },
        endAbsolut: {
            question: "Your perfect drink is an Absolut vodka! </br>" +
                "<img  class='quiz-images' src='Images/absolut.jpg' alt='vodka'/>"
        },
        endAbsolutCitron: {
            question: "Your perfect drink is an Absolut Citron vodka! </br>" +
                "<img  class='quiz-images' src='Images/absolut-citron.jpg' alt='vodka'/>"
        },
        endGreyGoose: {
            question: "Your perfect drink is a Grey Goose vodka! </br>" +
                "<img  class='quiz-images' src='Images/greygoose.jpg' alt='vodka'/>"
        },
        // Martini endings
        endMartiniRosso: {
            question: "Your perfect drink is a Martini Rosso! </br>" +
                "<img  class='quiz-images' src='Images/martinirosso.jpg' alt='martini'/>"
        },
        endMartiniBianco: {
            question: "Your perfect drink is a Martini Bianco! </br>" +
                "<img  class='quiz-images' src='Images/martinibianco.jpg' alt='martini'/>"
        },
        //Rum endings
        endWhiteRum: {
            question: "Your perfect drink is a Captain Morgan White Rum! </br>" +
                "<img  class='quiz-images' src='Images/rum-white.jpg' alt='rum'/>"
        },
        endDarkRum: {
            question: "Your perfect drink is a Captain Morgan Dark Rum! </br>" +
                "<img  class='quiz-images' src='Images/rum-dark.jpg' alt='rum'/>"
        },
        endSpicedGoldRum: {
            question: "Your perfect drink is a Captain Morgan Spiced Gold Rum! </br>" +
                "<img  class='quiz-images' src='Images/rum-gold.jpg' alt='rum'/>"
        },
        //Cocktail endings
        endBasilicZest: {
            question: "Your perfect cocktail is a Basilic Zest! </br>" +
                "<img  class='quiz-images' src='Images/Basilic-Zest.jpg' alt='cocktail'/>"
        },
        endTomCollins: {
            question: "Your perfect cocktail is a Tom Collins! </br>"+
                "<img  class='quiz-images' src='Images/tom-collins.jpg' alt='cocktail'/>"
        },
        endZionSour: {
            question: "Your perfect cocktail is a Zion Sour! </br>"+
                "<img  class='quiz-images' src='Images/zion-sour.jpg' alt='cocktail'/>"  /* !!!!!!!! */
        },
        endPaloma: {
            question: "Your perfect cocktail is a Paloma! </br>"+
                "<img  class='quiz-images' src='Images/paloma.jpg' alt='cocktail'/>"
        },
        endCaipiroska: {
            question: "Your perfect cocktail is a Caipiroska! </br>"+
                "<img  class='quiz-images' src='Images/caipiroska.jpg' alt='cocktail'/>"
        },
        endCaipirinja: {
            question: "Your perfect cocktail is a Caipirinja! </br>"+
                "<img  class='quiz-images' src='Images/caipirinja.jpg' alt='cocktail'/>"
        },
        endMojito: {
            question: "Your perfect cocktail is a Mojito! </br>"+
                "<img  class='quiz-images' src='Images/mojito.jpg' alt='cocktail'/>"
        },
        endMojitoStrawberry: {
            question: "Your perfect cocktail is a Mojito Strawberry! </br>"+
                "<img  class='quiz-images' src='Images/mojito-strawberry.jpg' alt='cocktail'/>"
        },
        endRosalia: {
            question: "Your perfect cocktail is a Rosalia! </br>"+
                "<img  class='quiz-images' src='Images/Rosalia.jpg' alt='cocktail'/>"
        },
        endTropicalTango: {
            question: "Your perfect cocktail is a Tropical Tango! </br>"+
                "<img  class='quiz-images' src='Images/=Tropical-Tango.jpg' alt='cocktail'/>"
        },
        endBubbleBreeze:{
            question: "Your perfect cocktail is a Bubble Breeze! </br>"+
                "<img  class='quiz-images' src='Images/Bubble-Breeze.jpg' alt='cocktail'/>"
        },
        endElCucumbre:{
            question: "Your perfect cocktail is an El Cucumbre! </br>"+
                "<img  class='quiz-images' src='Images/El-Cucumbre.jpg' alt='cocktail'/>"
        },
        endBramble: {
            question: "Your perfect cocktail is a Bramble! </br>"+
                "<img  class='quiz-images' src='Images/bramble.jpg' alt='cocktail'/>"
        },
        endTequilaSunrise: {
            question: "Your perfect cocktail is a Tequila Sunrise! </br>"+
                "<img  class='quiz-images' src='Images/tequila-sunrise.jpg' alt='cocktail'/>"
        },
        endPassionfruitMargarita: {
            question: "Your perfect cocktail is a Passionfruit Margarita! </br>"+
                "<img  class='quiz-images' src='Images/passionfruit-margarita.jpg' alt='cocktail'/>"
        },
        endPornstarMartini: {
            question: "Your perfect cocktail is a Pornstar Martini! </br>"+
                "<img  class='quiz-images' src='Images/pornstar-martini.jpg' alt='cocktail'/>"
        },
        endPeachMajchin: {
            question: "Your perfect cocktail is a Peach Majchin! </br>"+
                "<img  class='quiz-images' src='Images/peach-majcin.jpg' alt='cocktail'/>"
        },
        endCincoDeMayo: {
            question: "Your perfect cocktail is a Cinco De Mayo! </br>"+
                "<img  class='quiz-images' src='Images/cinco-de-mayo.jpg' alt='cocktail'/>"
        },
        endMargarita: {
            question: "Your perfect cocktail is a Margarita! </br>"+
                "<img  class='quiz-images' src='Images/margarita.jpg' alt='cocktail'/>"
        },
        endCosmopolitan: {
            question: "Your perfect cocktail is a Cosmopolitan! </br>"+
                "<img  class='quiz-images' src='Images/cosmopolitan.jpg' alt='cocktail'/>"
        },
        endMojoJojo: {
            question: "Your perfect cocktail is a Mojo Jojo! </br>"+
                "<img  class='quiz-images' src='Images/mojo-jojo.jpg' alt='cocktail'/>"
        },
        endVodkaSour: {
            question: "Your perfect cocktail is a Vodka Sour! </br>"+
                "<img  class='quiz-images' src='Images/vodka-sour.jpg' alt='cocktail'/>"
        },
        endJungleBird: {
            question: "Your perfect cocktail is a Jungle Bird! </br>"+
                "<img  class='quiz-images' src='Images/jungle-bird.jpg' alt='cocktail'/>"
        },
        endNegroni: {
            question: "Your perfect cocktail is a Negroni! </br>"+
                "<img  class='quiz-images' src='Images/negroni.jpg' alt='cocktail'/>"
        }
    }
;

// Quiz Functionality
const quizContainer = document.getElementById("question");
const optionsContainer = document.getElementById("options");

let currentStep = "start";

function loadQuestion(step) {
    const current = quizData[step];
    quizContainer.innerHTML = current.question;
    optionsContainer.innerHTML = ""; // Clear previous options

    if (current.answers) {
        Object.keys(current.answers).forEach(answer => {
            const button = document.createElement("button");
            button.textContent = answer;
            button.onclick = () => loadQuestion(current.answers[answer]);
            optionsContainer.appendChild(button);
        });
    }
}

// Load the first question
loadQuestion(currentStep);



