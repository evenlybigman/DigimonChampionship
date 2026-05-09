const EVOLUTION_TREE = {
    putimon: [
        {
            to: "cupimon",
            conditions: {
                minTicks: 180,
            },
        }
    ],

    cupimon: [
        {
            to: "luxmon",
            conditions: {
                battles: 3,
            }
        }
    ],

    luxmon: [
        {
            to: "angelmon",
            conditions: {
                battles: 3,
            }
        },
        {
            to: "piddomon",
            conditions: {
                battles: 3,
                defeats: 2,
            }
        },
        {
            to: "darcmon",
            conditions: {
                age: 5,
            }
        }
    ]
}