Funny <: Arithmetic {
    Module = Function+

    Function = variable 
        "(" ParamList ")" 
        Preopt? 
        "returns" ParamListNonEmpty 
        UsesOpt? 
        Statement

    ParamList = ListOf<Param, ",">
    ParamListNonEmpty = ListOf<Param, ",">
    Param = variable ":" Type
    Preopt = "requires" Predicate 
    UsesOpt = "uses" ParamList 

    Type = "int" "[]" -- array
        | "int" -- int

    Statement = Assignment
        | Block
        | Conditional
        | While
        | FunctionCall ";" -- function_call_statement

    Assignment = LValueList "=" ExprList ";"    -- tuple_assignment
        | LValue "=" Expr ";"                   -- simple_assignment
    LValueList = ListOf<LValue, ",">
    ExprList = ListOf<Expr, ",">
    LValue = variable "[" Expr "]"              -- array_access
        | variable                               -- variable
    Block = "{" Statement* "}"
    Conditional = "if" "(" Condition ")" Statement ("else" Statement)?
    While = "while" "(" Condition ")" InvariantOpt? Statement
    InvariantOpt = "invariant" Predicate 

    AtomExpr := FunctionCall
        | ArrayAccess
        | ...
    FunctionCall = variable "(" ArgList ")"
    ArgList = ListOf<Expr, ",">
    ArrayAccess = variable "[" Expr "]"

    AndOp<C> = C "and" C
    OrOp<C> = C "or" C
    NotOp<C> = "not" C
    ParenOp<C> = "(" C ")"
    
    Condition = ImplyCond
    ImplyCond = OrCond ("->" ImplyCond)?
    OrCond = AndCond ("or" AndCond)*
    AndCond = NotCond ("and" NotCond)*
    NotCond = ("not")* AtomCond

    AtomCond = "true"           -- true
        | "false"               -- false
        | Comparison            -- comparison
        | "(" Condition ")"     -- paren

    Comparison = Expr "==" Expr                 -- eq
        | Expr "!=" Expr                        -- neq
        | Expr ">=" Expr                        -- ge
        | Expr "<=" Expr                        -- le
        | Expr ">"  Expr                        -- gt
        | Expr "<"  Expr                        -- lt

    Predicate = ImplyPred
    ImplyPred = OrPred ("->" ImplyPred)?
    OrPred = AndPred ("or" AndPred)*
    AndPred = NotPred ("and" NotPred)*
    NotPred = ("not")* AtomPred

    AtomPred = Quantifier     -- quantifier
        | FormulaRef          -- formula_ref
        | "true"              -- true
        | "false"             -- false
        | Comparison          -- comparison
        | "(" Predicate ")"   -- paren

    Quantifier = ("forall" | "exists") 
        "(" Param "|" Predicate ")"
    FormulaRef = variable "(" ParamList ")"

    space := " " | "\t" | "\n" | comment | ...
    comment = "//" (~endOfLine any)* endOfLine
    endOfLine = "\r" | "\n" | "\r\n"
    spaces := space+ | ...
}
