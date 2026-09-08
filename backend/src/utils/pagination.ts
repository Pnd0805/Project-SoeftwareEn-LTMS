import type { ParsedQs } from 'qs';

export function parsePagination(rawPage : string | string[] | ParsedQs | undefined , rawpageSize : string | string[] | ParsedQs | undefined){
    const page = Number(rawPage);
    const pageSize = Number(rawpageSize);

    let newpage , newpageSize;
    if(Number.isInteger(page) && page >= 1){
        newpage = page;
    }
    else{
        newpage = 1;
    }

    if(Number.isInteger(pageSize) && pageSize >= 1){
        newpageSize = Math.min(pageSize, 100);
    }
    else{
        newpageSize = Math.min(20, 100);
    }

    const offset = (newpage - 1) * newpageSize;
    return {newpage , newpageSize , offset};
}

export function buildPagination(page : number , pageSize : number , totalItems : number){

    const totalPages = Math.ceil( totalItems / pageSize);
    return{ page , pageSize , totalItems , totalPages};

}