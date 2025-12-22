Funny <: Arithmetic {  
  Module = Function+
  
  Function = variable "(" ParameterList ")" 
             Preopt? 
             ReturnList
             Postopt?
             Useopt?
             Statement
  
  Preopt = "requires" Predicate
  Postopt = "ensures" Predicate
  Useopt = ("uses" ParameterList)
  ParameterList = ListOf<VarDecl, ",">
  ParameterListNotEmpty = NonemptyListOf<VarDecl, ",">
  ReturnList = "returns" ParameterListNotEmpty --paramlist 
  |  "returns" "void" --void
  
  VarDecl = variable ":" Type

  Type = "int[]" --int_arr
       | "int" --int

  Statement = Assignment | Conditional | Loop | Block | Expr ";" --expr
  
  Assignment = 
      | LValue "=" Expr ";"                          -- simple
      | ArrayAccess "=" Expr ";"                     -- array
      | ListOf<LValue, ","> "=" FunctionCall ";"  -- tuple
  
  LValue = variable
  
  Conditional = "if" "(" Condition ")" Statement ("else" Statement)?
  
  Loop = "while" "(" Condition ")" 
         Invariant?
         Statement
  Invariant = ("invariant" Predicate)
  Block = "{" Statement* "}"
  
  FunctionCall = variable "(" ArgumentList ")"
  ArgumentList = ListOf<Expr, ",">
  
  ArrayAccess = variable "[" Expr "]"
  
  Condition = 
      | "true" --true
      | "false" --false
      | Comparison --comp
      | "not" Condition --not
      | Condition "and" Condition --and
      | Condition "or" Condition --or
      | Condition "->" Condition --imp
      | "(" Condition ")" --parent
  
  Comparison = 
      | Expr "==" Expr
      | Expr "!=" Expr
      | Expr ">=" Expr
      | Expr "<=" Expr
      | Expr ">" Expr
      | Expr "<" Expr
  
  Predicate = 
  	  | Predicate "->" Predicate --imp
      | Predicate "or" Predicate --or
      | Predicate "and" Predicate --and
      | "not" Predicate --not
      | Quantifier --quant
      | FormulaRef --formulaRef
      | "true" --true
      | "false" --false
      | Comparison --comp
      | "(" Predicate ")" --parent
  
  Quantifier = ("forall" | "exists") "(" VarDecl "|" Predicate ")"
  
  FormulaRef = variable "(" ParameterList ")"
  
  Expr := 
      | FunctionCall
      | ArrayAccess
      | ...                
  
    space := " " | "\t" | "\n" | comment | ...
    comment = "//" (~endOfLine any)* endOfLine
    endOfLine = "\r" | "\n" | "\r\n"
    spaces := space+ | ...
}