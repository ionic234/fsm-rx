# Change Log
All notable changes to this project will be documented in this file.


## 1.1.0 - 
* Remove minification from the build step. 
* Base FsmRx class renamed to FmsRxInheritable (minor breaking change)
* generateStateTransition renamed to generateStateDiagramTransition (minor breaking change)
* assertCannotReach made static and now accessible via FsmRx derived classes (minor breaking change)
* destroy$, nextChangeStateTransition$, override$ now return as observables from a getter rather than subjects.(minor breaking change) 
* resolvedFsmConfig and isInDevMode made readonly. 
* nextChangeStateTransition$ now omits the data of the state being left. 
* added currentStatePostInit$ getter which pre-filters the init state. 
* added FsmRxConcrete for use with functional components. 

## 1.0.1 - 8/4/2024
* Added CHANGELOG.md
* Updated README.md file
* Updated BaseFsmConfig documentation

## 1.0.0 - 3/4/2024
* Initial release 
