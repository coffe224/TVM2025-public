
Funnier <: Funny {
    Module := Formula* Function+

    Formula = variable "(" ParamList ")" "=>" Predicate ";"

    Preopt := "requires" Predicate ("and" Predicate)*
    Postopt = "ensures" Predicate ("and" Predicate)*
    
    Function := variable 
        "(" ParamList ")" 
        Preopt? 
        "returns" ("void" | ParamListNonEmpty) 
        Postopt?
        UsesOpt? 
        Statement

    InvariantOpt := "invariant" Predicate 
}
