export class AppError extends Error{
    constructor(
        public status : number,
        public code : string,
        message : string,
        public extra? : Record<string , unknown> ,
    ) {
        super(message);
    }
}