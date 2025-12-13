export type Expr 
    = BinExpr
    | AtomExpr; 

export type BinExpr
    = AddExpr
    | SubExpr
    | MulExpr
    | DivExpr

export interface AddExpr {
    type: 'add_op',
    op: '+'
    left_arg: Expr,
    right_arg: Expr,
}

export interface SubExpr {
    type: 'sub_op',
    op: '-'
    left_arg: Expr,
    right_arg: Expr,
}

export interface MulExpr {
    type: 'mul_op',
    op: '*'
    left_arg: Expr,
    right_arg: Expr,
}

export interface DivExpr {
    type: 'div_op',
    op: '/'
    left_arg: Expr,
    right_arg: Expr,
}

export type AtomExpr
    = NegExpr
    | Variable
    | Num

export interface NegExpr {
    type: 'unary_min',
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



