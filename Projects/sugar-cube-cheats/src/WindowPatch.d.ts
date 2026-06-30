declare interface SugarCubeWindow extends Window {
    SugarCube?: {
        State?: {
            active?: {
                variables?: Record<string, any>;
            };
        };
    };
}

