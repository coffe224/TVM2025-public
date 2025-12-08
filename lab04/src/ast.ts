export type Expr 
    = NryExpr
    | AtomExpr; 

export type NryExpr
    = AddExpr
    | MulExpr;

export interface AddExpr {
    type: 'add_op',
    ops: string[],
    args: Expr[]
}

export interface MulExpr {
    type: 'mul_op',
    ops: string[],
    args: Expr[]
}

export type AtomExpr
    = NegExpr
    | BracExpr
    | Variable
    | Num

export interface NegExpr {
    type: 'unary_min',
    arg: Expr
}

export interface BracExpr {
    type: 'brac_expr',
    arg: Expr
}

export interface Variable {
    type: 'variable',
    value: string
}

export interface Num {
    type: 'number',
    value: number
}



